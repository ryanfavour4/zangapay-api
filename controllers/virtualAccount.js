const { default: axios } = require("axios");
const FincraVirtualAccounts = require("../models/fincraVirtualAccounts");
const customError = require("../customError");
const { v4 } = require("uuid");
const jwt = require("jsonwebtoken");
const os = require("os");
const path = require("path");
const fs = require("fs");
const VirtualAccounts = require("../models/virtualAccounts");
const dotenv = require("dotenv");

dotenv.config();

const paystackBaseUrl = "https://api.paystack.co";
const paystackLiveKey = "sk_live_2b9869aa9472d35555827ef98d7112a5bf1e2c47";
// const paystackLiveKey = "sk_test_63a0e81026c20e744a08f18c5d7b724f905540c2"
const safeHavenUrl = "https://api.sandbox.safehavenmfb.com";

const fincraUrl = "https://api.fincra.com/profile/virtual-accounts";

function isAccountValid(expiresAt) {
    console.log(expiresAt);
    const expirationDate = new Date(expiresAt);
    const currentDate = new Date();

    console.log(expirationDate, "expire date");

    console.log(currentDate, "current date");

    return currentDate > expirationDate;
}

async function generateFincraVirtualAccount(req, res, next) {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        let userAccount = await VirtualAccounts.findOne({ userId });

        if (userAccount) {
            if (userAccount?.fincraAccount) {
                // Check if the existing Fincra account is expired
                if (!isAccountValid(userAccount.fincraAccount.expiresAt)) {
                    return res.json({
                        message: "Fincra virtual account is still valid",
                    });
                }

                // Account is expired, so update it
                const reference = v4();
                const payload = {
                    amount: "0",
                    expiresAt: "15815520",
                    merchantReference: reference,
                };
                const response = await axios.post(
                    `${fincraUrl}/transfer`,
                    payload,
                    {
                        headers: {
                            "api-key": "7HnUNPtLG08ZJI1U4MQ1WFOFiIUm8erU",
                        },
                    }
                );

                const fincraData = {
                    accountNumber:
                        response.data.data.accountInformation.accountNumber,
                    accountName:
                        response.data.data.accountInformation.accountName,
                    bankName: response.data.data.accountInformation.bankName,
                    expiresAt: new Date(response.data.data.expiresAt),
                };

                await VirtualAccounts.findByIdAndUpdate(userAccount._id, {
                    $set: { fincraAccount: fincraData },
                });

                return res.json({
                    message: "Fincra virtual account updated successfully",
                });
            }
        }
        // If the user has no virtual account at all, create a new one
        const reference = v4();
        const payload = {
            amount: "0",
            expiresAt: "15815520",
            merchantReference: reference,
        };
        const response = await axios.post(`${fincraUrl}/transfer`, payload, {
            headers: { "api-key": "7HnUNPtLG08ZJI1U4MQ1WFOFiIUm8erU" },
        });

        const newUserAccount = new VirtualAccounts({
            userId,
            fincraAccount: {
                accountNumber:
                    response.data.data.accountInformation.accountNumber,
                accountName: response.data.data.accountInformation.accountName,
                bankName: response.data.data.accountInformation.bankName,
                expiresAt: new Date(response.data.data.expiresAt),
            },
        });

        await newUserAccount.save();

        return res.json({
            message: "Fincra virtual account created successfully",
        });
    } catch (err) {
        console.error(err);
        next(customError(err));
    }
}

//  async function getUserVirtualAccounts(req, res, next){
//     try{
//         const {userId} = req.params

//         const checkIfUserAccountExists = await VirtualAccounts.find({userId})

//         if(checkIfUserAccountExists.length === 0){
//             throw new customError('No virtual account found for this user')
//         }

//         return res.json({data: 'User virtual account found', message: checkIfUserAccountExists})
//     }
//     catch(err){
//         console.log(err)
//         next(customError(err))
//     }
//  }

// Generate Client Assertion
function generateClientAssertion() {
    //     const privateKey = `-----BEGIN PRIVATE KEY-----
    // MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDmZbwn69CgiV3J
    // ZGY1Qw7x8yzf+1yRYX7vKqO9xbodjk0olBKkv7/PZd8Za1I3BD4PHvBT9JIY5oFU
    // 07LQhOUDKDbAHdhXBmCPxASua0r6tvzn4t93AeLvES7d32RgF8c1SN8BUU3xd5j9
    // iBczC8Bj1G1jfcSot5ytge4xNGNjjd7FKvkOQuuhwhmb4RAVQPCLfyj7CCZrjmDS
    // TiBlYo4ITEMSFcRxAGlqxFz0/tDperCByVW30NwxYkY+kA1dyU7qzD4frqhLGiqv
    // rK2A75UeHGZa9VZjJDJ5T4KjMgRiwMV4xdZ6jIPPUQFowvlnzm1lG8G+EXBEBA7O
    // Io9z/VpfAgMBAAECggEAZLLqffhPgxsG5tL+6SCaE53ZazwNxWz7ccUNNBCLvAdK
    // KgYt79vvFdLMo+uIT4uHJEy9dbRbdo6o0E6GxSSQg8S7yVRCDic3ZR6jfShf6Ry5
    // hRBf4z/r09mKxmaxFF7QLrXe4lCK5JMFRyqIGUN1nyxlcyqxHZzC2gMD/HWNSyEO
    // fzHZTyaXnXBYeTh8q57ksSfb+fIhfKqNfghqAolznYlBzHzagQc6PIBPM5e1XZhK
    // lYdrFvFP273CYq2QJifOaXhH4b/gazQfDJ2Mjd+spm+Gybudu97CfW8L13b6Rkfq
    // B47uBMdklus4XRVxk5xQR+OfP2p+mtrKvbi3MLb2wQKBgQD2bhPmP0AdzRoNyc+4
    // E8CzFf/pFKYhcIcTj2acjgXWncAj3K2Jt71Xzwc+p+lH+b5VGMJ4yDn3wTMYodjw
    // Kp6mhsJGYKfLBWvWXt9+8cEufNN2Zw5obYHnK0sDoiyq8pfSzXBK6SxZNbv/CQqM
    // Mn2O5MxFYF4OvL2VcVcfW05hCQKBgQDvWERKrPqFcDOYDPlNrGLQ0RTiuK00gIQC
    // 7vvkRCbb47GOqLXZk4f2zIN+SeBeBpm26XSt1UZAu7U3+bwzcDoGXS/QZ2heaBEe
    // uJN44xUjsExJa/ZOc4CiEPreQM7aH72N9++lWHxuidqnthMG656yNMX3YznsQk13
    // dpMf7xaCJwKBgHhGw9mmV3H0MFo4fPTYVz5RZ4VouakqlhMa87dHrlvQxP378It+
    // LaEU//E53SdvItG/8vMmrvxYxMqp/AtEkgivT1UwSdVSgQ6xYZ5A+svoywFITYT0
    // pemhfMx6NBj/rNCLytoVMrsb+fUBga9p2VSMIZNe9Kl2v4WYOzCnzPqZAoGBAOgg
    // 2jL2qw4JsPBR/ORZQYk2jqQI6mtWDTJvJ7vOYUW4AjfS5nO7gw1YcltkOQfYLPLa
    // XsBNbZJQusQsIFxfBtevPzVHZVDSa3A5IUYILzNqw8IdxEd3/BSylSxC/JtOV2A+
    // S504QY5PgtJPYwq+MC6zwiBZiw7ZixpG1RAOqOzXAoGAUG4Uj3rIojpyjjkirQbF
    // nWNzQelVmYvjCtEp2puL0vFoIH7BP2hObDeeJrMJd5/W9me/8EY4EpQgj6MlpDED
    // jBMoEvNSeGO5zKeaPtqrB/2LFZyJ2ssSMEGgcBlTS9KTPmr+foo7AfkYFnUwI+mc
    // 5lSj4AetQea9C5W8hM/Qy2U=
    // -----END PRIVATE KEY-----
    // `;

    const privateKey = process.env.SAFEHAVEN_PRIVATE_KEY.replace(/\\n/g, "\n");

    console.log(process.env.SAFEHAVEN_CLIENT_ID, "client id");

    console.log(privateKey, "private key");
    const payload = {
        iss: "https://zangapay.com", // company website url
        sub: process.env.SAFEHAVEN_CLIENT_ID, // oauth client id
        aud: process.env.SAFEHAVEN_URL, // Sandbox or production URL
        iat: Math.floor(Date.now() / 1000), // Current timestamp
        exp: Math.floor(Date.now() / 1000) + 3600, // Expiry in 1 hour
    };

    const header = {
        alg: "RS256",
        typ: "JWT",
    };

    return jwt.sign(payload, privateKey, { algorithm: "RS256", header });
}

// Get Access Token
async function getAccessToken() {
    const clientAssertion = generateClientAssertion();

    console.log(clientAssertion, "client");
    try {
        const response = await axios.post(
            `${process.env.SAFEHAVEN_URL}/oauth2/token`,
            {
                grant_type: "client_credentials",
                client_assertion_type:
                    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: clientAssertion,
                client_id: process.env.SAFEHAVEN_CLIENT_ID,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        console.log(response.data, "access");
        return response.data;
    } catch (error) {
        console.error(
            "Error obtaining access token:",
            error.response?.data || error.message
        );
        throw new Error("Failed to obtain access token");
    }
}

// Create Virtual Account
async function generateSafeHavenVirtualAccount(req, res, next) {
    console.log(
        "HIT THE GENERATE SAFE HAVEN VIRTUAL ACCOUNT ENDPOINT",
        res.body
    );

    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        let userAccount = await VirtualAccounts.findOne({ userId });

        if (userAccount) {
            if (userAccount?.safeHavenAccount) {
                // Check if the existing SafeHaven account is expired
                if (!isAccountValid(userAccount.safeHavenAccount.expiresAt)) {
                    return res.json({
                        message: "SafeHaven virtual account is still valid",
                    });
                }

                // Account is expired, so update it
                const accessToken = await getAccessToken();
                const accountData = {
                    validFor: 900,
                    settlementAccount: {
                        bankCode: "090286",
                        accountNumber: "0114273505",
                    },
                    amountControl: "Fixed",
                    amount: 0,
                    callbackUrl: "https://zangapay.com",
                    externalReference: v4(),
                };

                const response = await axios.post(
                    `${process.env.SAFEHAVEN_URL}/virtual-accounts`,
                    accountData,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken?.access_token}`,
                            "Content-Type": "application/json",
                            ClientID: process.env.SAFEHAVEN_CLIENT_ID,
                        },
                    }
                );

                console.log(response.data, "respose");

                const safeHavenData = {
                    accountNumber: response.data.data.accountNumber,
                    accountName: response.data.data.accountName,
                    bankName: response.data.data.bankName || "Safe Haven",
                    expiresAt: new Date(response.data.data.expiryDate),
                };

                await VirtualAccounts.findByIdAndUpdate(userAccount._id, {
                    $set: { safeHavenAccount: safeHavenData },
                });

                return res.json({
                    message: "SafeHaven virtual account updated successfully",
                });
            }
        }

        // If the user has no virtual account at all, create a new one
        const accessToken = await getAccessToken();
        // 0114121606
        // 999240
        const accountData = {
            validFor: 900,
            settlementAccount: {
                bankCode: "090286",
                accountNumber: "0114121606",
            },
            amountControl: "Fixed",
            amount: 0,
            callbackUrl: "https://zangapay.com",
            externalReference: v4(),
        };

        const response = await axios.post(
            `${process.env.SAFEHAVEN_URL}/virtual-accounts`,
            accountData,
            {
                headers: {
                    Authorization: `Bearer ${accessToken?.access_token}`,
                    "Content-Type": "application/json",
                    ClientID: process.env.SAFEHAVEN_CLIENT_ID,
                },
            }
        );

        console.log(response.data, "data");

        const newUserAccount = new VirtualAccounts({
            userId,
            safeHavenAccount: {
                accountNumber: response.data.data.accountNumber,
                accountName: response.data.data.accountName,
                bankName: response.data.data.bankName || "Safe Haven",
                expiresAt: new Date(response.data.data.expiryDate),
            },
        });

        await newUserAccount.save();

        return res.json({
            message: "SafeHaven virtual account created successfully",
        });
    } catch (error) {
        console.error(
            "Error creating virtual account:",
            error.response?.data || error.message
        );
        return res.status(500).json({
            message: "Failed to create SafeHaven virtual account",
            error: error.response?.data || error.message,
        });
    }
}

async function checkIfCustomerExist(email) {
    try {
        const res = await axios.get(`${paystackBaseUrl}/customer/${email}`, {
            headers: { Authorization: `Bearer ${paystackLiveKey}` },
        });
        if (res.data.status) {
            return res.data.data;
        }
    } catch (error) {
        return null;
    }
}

async function generatePaystackVirtualAccount(req, res, next) {
    try {
        const { userId, email, firstName, lastName, phone } = req.body;
        console.log("body of gn:", req.body);
        let user = await VirtualAccounts.findOne({ email });
        if (user) {
            return res.json({
                message: "User Already Exist",
                customerCode: user.customerCode,
                virtualAccount: user.VirtualAccount,
                bankName: user.bankName,
            });
        }
        const existingCustomer = await checkIfCustomerExist(email);

        let customerCode;
        if (existingCustomer) {
            customerCode = existingCustomer.customer_code;
        } else {
            const customerResponse = await axios.post(
                `${paystackBaseUrl}/customer`,
                {
                    email,
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    metadata: { user_id: userId },
                },
                {
                    headers: { Authorization: `Bearer ${paystackLiveKey}` },
                }
            );

            if (!customerResponse.data.status) {
                return res
                    .status(500)
                    .json({ message: "Failed to create customer" });
            }
            customerCode = customerResponse.data.data.customer_code;
        }
        // generate acc
        const accResponse = await axios.post(
            `${paystackBaseUrl}/dedicated_account`,
            {
                customer: customerCode,
                preferred_bank: "wema-bank",
                country: "NG",
                account_number: "auto",
                metadata: { user_id: userId },
            },
            { headers: { Authorization: `Bearer ${paystackLiveKey}` } }
        );

        if (!accResponse.data.status) {
            return res
                .status(500)
                .json({ message: "Failed to create virtual account" });
        }

        const accountData = accResponse.data.data;
        console.log("Account Data:", accountData);
        const newUserAccount = new VirtualAccounts({
            userId,
            fincraAccount: {
                accountNumber: accountData.account_number,
                accountName: accountData.account_name,
                bankName: accountData.bank.name,
                expiresAt: accountData.expiresAt,
                walletBalance: 0, //no model yet
            },
        });
        await newUserAccount.save();

        res.json({
            message: "Customer & Virtual Account Created Successfully",
            customerCode,
            virtualAccount: accountData.account_number,
            bankName: accountData.bank.name,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred" });
    }
}

async function getUserVirtualAccounts(req, res, next) {
    try {
        const { userId } = req.params;
        console.log(req.params, req.body);

        const checkIfUserAccountExists = await VirtualAccounts.find({ userId });
        console.log(req.params, req.body);

        if (checkIfUserAccountExists.length === 0) {
            throw new customError("No virtual account found for this user");
        }

        return res.json({
            data: "User virtual account found",
            message: checkIfUserAccountExists,
        });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

module.exports = {
    generateFincraVirtualAccount,
    getUserVirtualAccounts,
    generateSafeHavenVirtualAccount,
    generatePaystackVirtualAccount,
};

