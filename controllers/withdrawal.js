const customError = require('../customError.js');
const Payments = require('../models/payments.js');
const Wallet = require('../models/wallet.js');
const { generateReference } = require('../utils/generateReference.js');
const axios = require('axios');
const { v4 } = require('uuid');
const { logActivity } = require('./admin.js');
const TransactionHistoryWallet = require('../models/transactionHistoryWallet.js');

const dotenv = require('dotenv')

dotenv.config()

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY; // Use your actual Paystack secret key

async function withdrawalWithPaystack(req, res, next) {
    try {
        const { code, account_number , name, amount , narration, fee } = req.body;

        console.log(code, account_number);
        const userId = req.userId;

        const checkIfUserWalletExists = await Wallet.find({ userId });

        if (checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'));

        if (checkIfUserWalletExists[0].balance < (+amount + +fee)) return next(customError('Insufficient funds'));

        // Step 1: Create a recipient
        const recipientDetails = {
            type: "nuban",
            name,
            account_number,
            bank_code: code,
        };

        const recipientResponse = await axios.post('https://api.paystack.co/transferrecipient', recipientDetails, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (recipientResponse.data.status === false) {
            return next(customError(recipientResponse.data.message));
        }

        const recipientCode = recipientResponse.data.data.recipient_code;

        // Step 2: Initiate the transfer
        const transferDetails = {
            recipient: recipientCode,
            amount: amount * 100,
            currency: "NGN",
            narration: narration || "Payment for things",
            reference: generateReference(),
        };
        console.log(fee, 'fee')

        console.log(transferDetails, 'transfer details')

        const transferResponse = await axios.post('https://api.paystack.co/transfer', transferDetails, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(transferResponse.data, 'response');

        if (transferResponse.data.status === false) {
            return next(customError(transferResponse.data.message));
        }

        // Step 3: Deduct the amount from the user's wallet
        const existingWallet = await Wallet.findOne({ userId });
        if (existingWallet) {
            existingWallet.balance -= amount + fee; // Deduct the amount
            await existingWallet.save();
            console.log(`💰 Wallet updated: NGN ${amount + fee} deducted.`);
        } else {
            console.log("❌ Wallet not found for user:", userId);
            return res.status(404).json({ message: "Wallet not found" });
        }

        // Step 4: Log the transaction history
        const newTransaction = new TransactionHistoryWallet({
            userId,
            transactionType: 'withdrawal',
            amount: +amount + fee, // Negative amount for withdrawal
            status: 'completed',
            details: `Withdrawn amount for transfer: ${transferResponse.data.data.reference}`,
            txId: transferResponse.data.data.reference,
            rId: v4(),
            name: 'Withdrawal',
        });

        await newTransaction.save();

        // Step 5: Log activity
        await logActivity(
            userId,
            'TRANSFER',
            `${name} withdrew ${amount + fee} for transfer to ${account_number}`,
            amount + fee,
            'success',
            {
                provider: code,
                account_number,
                narration
            }
        );

        return res.json({ message: transferResponse.data });
    } catch (err) {
        console.log(err);
        if(err.response.data.code === 'insufficient_balance'){
            next(customError('Service is currently unavailable'))
        }
        next(customError(err));
    }
}

module.exports = {
    withdrawalWithPaystack
};