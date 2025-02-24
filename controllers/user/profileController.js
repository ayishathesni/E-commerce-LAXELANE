
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema');
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { response } = require('express');
const mongoose = require ('mongoose')
const { ObjectId } = require("mongoose").Types;








function generateOtp(){
    const digits="1234567890"
    let otp="";
    for(let i=0;i<6;i++){
        // otp+=digits(Math.floor(Math.random()*10))
        otp += digits.charAt(Math.floor(Math.random() * 10));  // ✅ Correct way to get a random digit
 
    }
    return otp;
}

// const getForgotPassPage = async (req,res)=>{
//     try{
//         res.render("user/forgot-password");
//     }catch(error){
//         res.redirect("/pageNotFound")
//     }
// }

const getForgotPassPage = async (req, res) => {
    try {
        res.render("user/forgot-password");
    } catch (error) {
        console.error("Error:", error);
        res.render("user/page404"); // Using correct path
    }
}


const sendVerificationEmail = async(email,otp)=>{
        try{
             const transporter=nodemailer.createTransport({
                service:'gmail',
                port:587,
                secure:false,
                requireTLS:true,
                auth:{
                    user:process.env.NODEMAILER_EMAIL,
                    pass:process.env.NODEMAILER_PASSWORD
                }
             })
            const mailOptios = {
                from:process.env.NODEMAILER_EMAIL,
                to:email,
                subject:"your OTP for password reset",
                text:`Your OTP is ${otp}`,
                html:`<b>Your OTP:${otp}</b>`
            }
        const info = await transporter.sendMail(mailOptios);
        console.log("email sent",info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending email",error);
        return false;
        
    }
}

const securePassword = async (password)=>{
    try {
      const passwordHash = await bcrypt.hash(password,10);
      return passwordHash;  
    } catch (error) {
        
    }
}

const forgotEmailValid = async (req,res)=>{
    try{
       const {email} = req.body;
       console.log("email",req.body);
       const findUser = await User.findOne({email:email});
       console.log("finduser",findUser)
       if(findUser){
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            req.session.userOtp = otp;
            req.session.email = email;
            res.render("user/forgotPass-otp");
            console.log("otp",otp);
            
        }else{
            res.json({success:false,message:"Failed to send OTP. Please try again"});
        }
       }else{
        res.render("user/forgot-password",{
            message:"User with this email does not exist"
        });
       }
    }catch(error){
        res.redirect("/pageNotFound")
    }
}


const verifyForgotPassOtp = async (req,res)=>{
    try{
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"});
        }
        else{
            res.json({success:false,message:"OTP not matching"});
        }
     
    }catch(error){
       res.status(500).json({sucess:false,message:"An error occured. Please try again"});
    }
}


const getResetPassPage = async (req,res) => {
    try {
    res.render("user/reset-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
    
}


const resendOtp = async(req,res)=>{
    try {
        const otp=generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("resending email:",email)
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend Otp",otp);
            res.status(200).json({success:true,message:"Resend OTP Successful"});
            
        }
    
    } catch (error) {
     console.error("Error in resend otp",error);
     res.staus(500).json({sucess:false,message:"Internal server error"})
    }
    
}

const postNewPassword = async(req,res)=>{
    try {
        const {newPass1,newPass2} = req.body;
        const email = req.session.email;
        if(!email) {
            return res.redirect("/forgot-password");
        }
        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
               {email:email},
               {$set:{password:passwordHash}}
            );
            res.redirect("/login");
               
        }else{
           res.render("user/reset-password",{message:"Passwords do not match"});
        }
    }catch (error) {
        console.error("Error:", error);
        res.render("user/page404");
    }
}

// const userProfile = async (req,res) => {
//     try {
//         const userId = req.session.user;
//         console.log("userid",userId)
//         const userData = await User.findById(userId);
//         const addressData = await Address.findOne({userId:userId})
//         res.render('user/profile',{userData,userAddress : addressData,
//             msgg: req.flash('message') || ''

//         })
//         console.log("address",userData);
//         console.log("address",addressData);
       
//     } catch (error) {
//        console.error("Error for retrieve profile data",error);
//        res.redirect("/pageNotFound") 
//     }
// }

const userProfile = async (req, res) => {
    try {
        const userId = req.session.user?._id; // Ensure user ID exists
        console.log("User ID:", userId);

        if (!userId) {
            req.flash('message', 'User not logged in.');
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        const addressData = await Address.findOne({ userId });

        console.log("Fetched addresses:", addressData?.address || []);

        res.render('user/profile', {
            userData,
            addresses: addressData ? addressData.address : [], // Pass an array
            msgg: req.flash('message') || ''
        });
    } catch (error) {
        console.error("Error retrieving profile data:", error);
        res.redirect("/pageNotFound");
    }
};


// Add these methods to your existing profile controller

const editProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const { name, phone } = req.body;

        // Input validation
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: "Name and phone are required"
            });
        }

        // Validate phone number format
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format"
            });
        }

        // Update user profile
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    name: name,
                    phone: phone
                }
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        req.flash('message', 'Profile Editted Successfully');
        res.json({
            success: true,
            message: "Profile updated successfully",
            user: {
                name: updatedUser.name,
                phone: updatedUser.phone
            }
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while updating profile"
        });
    }
};

const updatePassword = async (req, res) => {
    try {
        const userId = req.session.user;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Input validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All password fields are required"
            });
        }

        // Get user from database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password
        const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Validate new password
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New passwords do not match"
            });
        }

        // Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"
            });
        }

        // Hash new password
        const hashedPassword = await securePassword(newPassword);

        // Update password in database
        await User.findByIdAndUpdate(
            userId,
            { $set: { password: hashedPassword } }
        );

        req.flash('message', 'Password Changed Successfully');
        res.json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while updating password"
        });
    }
};

// const addAddress = async (req,res) =>{
//     try {
//         const user = req.session.user;
//         res.render("user/add-address",{user:user})
//     } catch (error) {
//         res.redirect("/pageNotFound")
//     }
    
// }

// const postAddAddress = async (req,res) =>{
//     try {
//         const userId = req.session.user;
//         const userData = await User.findOne({_id:userId});
//         const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body;

//         const userAddress = await Address.findOne({userId : userData._id});
//         if(!userAddress){
//             const newAddress = new Address({
//                 userId : userData._id,
//                 address:[{addressType,name,city,landMark,state,pincode,phone,altPhone}]

//             });
//             await newAddress.save();
//         }else{
//             userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone});
//             await userAddress.save();
//         }
//         res.redirect("/userProfile");
//     } catch (error) {
//         console.error("Error adding address",error);
//         res.redirect("/pageNotFound");
//     }
    
// }

// const editAddress = async (req,res) => {
//     try {
//        const addressId = req.query.id;
//        const user = req.session. user;
//        const currAddress = await Address.findOne({
//         "address._id" : addressId,
//        })
//        if(!currAddress){
//         return res.redirect("/pageNotFound")
//        }
     
//        const addressData = currAddress.address.find((item)=>{
//         return item._id.toString()===addressId.toString();
//        })
//         if(!addressData){
//             return res.redirect("/pageNotFound")
//         }
//         res.render("edit-address",{address:addressData.user })

//     } catch (error) {
//         console.error("Error in edit Address",error);
//         res.redirect("/pageNotFound");
//     }
    
// }

// const postEditAddress = async (req,res) => {
//     try {
//         const data = req.body;
//         const addressId = req.query.id;
//         const user = req.session.user;
//         const findAddress = await Address.findOne({"address._id":addressId});
//         if(!findAddress){
//             res.redirect("/pageNotFound")
//         }
//         await Address.updateOne(
//             {"address._id":addressId},
//             {$set:{
//                 "address.$" :{
//                  _id : addressId,
//                  addressType : data.addressType,
//                  name : data.name,
//                  city : data.city,
//                  landMark : data.landMark,
//                  state : data.state,
//                  pincode : data.pincode,
//                  phone : data.phone,
//                  altPhone : data.altPhone,
//                 }
//             }}
//         )
//         res.redirect("/userProfile");
//     } catch (error) {
//         console.error("Error in edit address",error);
//         res.redirect("/pageNotFound")
//     }
    
// }

// const deleteAddress = async (req,res) => {
//     try {
//         const addressId = req.query.id;
//         const findAddress = await Address.findOne({"address._id" : addressId});
//         if(!findAddress){
//             return res.status(404).send("Address not found")
//         }
//       await Address.updateOne({
//         "address._id":addressId
//       ,
//     },
//      {
//        $pull:{
//         address : {
//             _id : addressId,
//         }
//        }
//      })
//      res.redirect("/userProfile")
//     } catch (error) {
//         console.error("Error in delete address",error);
//         res.redirect("/pageNotFound")
//     }
    
// }

//2 addd
// const addAddress = async (req, res) => {
//     try {
//         const userData = req.session.user || null; // Ensure user is defined
//         res.render("user/add-address", { userData }); // Pass `user` instead of `userData`
//     } catch (error) {
//         console.error("Error showing add address page", error);
//         res.redirect("/pageNotFound");
//     }
// };

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        const addressData = await Address.findOne({ userId });

        // Pass addresses to EJS
        res.render("user/add-address", { 
            userData, 
            addresses: addressData ? addressData.address : []  // Ensure addresses is always an array
        });

    } catch (error) {
        console.error("Error showing add address page", error);
        res.redirect("/pageNotFound");
    }
};



// Post Add Address
const postAddAddress = async (req, res) => {
    try {
        console.log("Request received:", req.body);

        if (!req.session.user || !req.session.user._id) {
            return res.status(400).send("User not logged in.");
        }
        const userId = req.session.user._id;
        const { addressType, name, city, landMark, state, pincode, phone, altPhone, address } = req.body.addressData;

        if (!addressType || !name || !city || !landMark || !state || !pincode || !phone || !altPhone || !address) {
            return res.status(400).send("All address fields are required.");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).send("User not found.");
        }
        console.log("User found:", userData);

        let userAddress = await Address.findOne({ userId });

        if (!userAddress) {
            userAddress = new Address({
                userId,
                address: [{ addressType, name, address, city, landMark, state, pincode, phone, altPhone }]
            });
        } else {
            userAddress.address.push({ addressType, name, address, city, landMark, state, pincode, phone, altPhone });
        }

        await userAddress.save();
        console.log("Address added successfully:", userAddress);
        res.json({ success: true, message: "Address added successfully", data: userAddress });

    } catch (error) {
        console.error("Error adding address:", error);
        res.redirect("/pageNotFound");
    }
};



// // Edit Address
// const editAddress = async (req, res) => {
//     try {
//         const addressId = req.query.id;  // Get address ID from query params
//         const user = req.session.user;  // Get the logged-in user
//         const currAddress = await Address.findOne({ "address._id": addressId });

//         if (!currAddress) {
//             return res.redirect("/pageNotFound");  // Redirect if address not found
//         }

//         const addressData = currAddress.address.find(item => item._id.toString() === addressId.toString());

//         if (!addressData) {
//             return res.redirect("/pageNotFound");  // Redirect if address data is not found
//         }

//         res.render("user/add-address", { address: addressData, user: user });  // Render add-address page with address data for editing
//     } catch (error) {
//         console.error("Error in edit address", error);
//         res.redirect("/pageNotFound");  // Redirect to error page if an error occurs
//     }
// };

const editAddress = async (req, res) => {
    try {
        const addressId = req.query.id;  // Get address ID from query params
        console.log("Received Address ID for editing:", addressId); // Debugging

        if (!addressId) {
            return res.status(400).json({ success: false, message: "No address ID provided" });
        }

        const user = req.session.user;   // Get the logged-in user
        console.log("Logged-in user:", user); // Debugging

        if (!user) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        // Convert ID to ObjectId
        const mongoose = require('mongoose');
        const objectId = new mongoose.Types.ObjectId(addressId);

        // Find the specific address inside the array
        const currAddress = await Address.findOne(
            { "address._id": objectId },
            { "address.$": 1 } // Fetch only the matching address
        );

        console.log("Fetched address from DB:", currAddress); // Debugging

        if (!currAddress || !currAddress.address || currAddress.address.length === 0) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        const addressData = currAddress.address[0]; // Extract matched address
        res.json({ success: true, address: addressData });

    } catch (error) {
        console.error("Error in edit address:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};



// Post Edit Address
// const postEditAddress = async (req, res) => {
//     try {
//         const data = req.body;
//         console.log("data recieved",req.body)
//         const addressId = req.query.id;
//         const user = req.session.user;
//         const findAddress = await Address.findOne({ "address._id": addressId });

//         if (!findAddress) {
//             return res.redirect("/pageNotFound");  // Redirect if address not found
//         }

//         // Update the address details
//         await Address.updateOne(
//             { "address._id": addressId },
//             {
//                 $set: {
//                     "address.$": {
//                         addressType: data.addressType,
//                         name: data.name,
//                         city: data.city,
//                         landMark: data.landMark,
//                         state: data.state,
//                         pincode: data.pincode,
//                         phone: data.phone,
//                         altPhone: data.altPhone
//                     }
//                 }
//             }
//         );
//         res.redirect("/userProfile");  // Redirect to user profile after editing address
//     } catch (error) {
//         console.error("Error in edit address", error);
//         res.redirect("/pageNotFound");  // Redirect to error page if an error occurs
//     }
// };





const postEditAddress = async (req, res) => {
    try {
        const data = req.body;
        const addressId = req.body.addressId;
        console.log("Received data:",data);
        console.log("Received address ID:",addressId);

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            console.error("Invalid address ID:", addressId);
            return res.redirect("/pageNotFound");
        }

        const findAddress = await Address.findOne({
            "address._id": new mongoose.Types.ObjectId(addressId),
        });
        

        if (!findAddress) {
            console.error("Address not found for ID:", addressId);
            return res.redirect("/pageNotFound");
        }

        console.log("Updating address with data:", {
            addressType: data.addressType,
            name: data.name,
            city: data.city,
            landMark: data.landMark,
            state: data.state,
            pincode: data.pincode,
            phone: data.phone,
            altPhone: data.altPhone
        });

        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$.addressType": data.addressType,
                    "address.$.name": data.name,
                    "address.$.city": data.city,
                    "address.$.landMark": data.landMark,
                    "address.$.state": data.state,
                    "address.$.pincode": data.pincode,
                    "address.$.phone": data.phone,
                    "address.$.altPhone": data.altPhone
                }
            }
        );

        console.log("Address updated successfully");
        res.json({ success: true, message: "Address updated successfully" });

    } catch (error) {
        console.error("Error in edit address", error);
        res.redirect("/pageNotFound");
    }
};

// Delete Address
// const deleteAddress = async (req, res) => {
//     try {
//         const addressId = req.query.id;
//         const findAddress = await Address.findOne({ "address._id": addressId });

//         if (!findAddress) {
//             return res.status(404).send("Address not found");  // Address not found
//         }

//         // Pull the address from the array and delete
//         await Address.updateOne(
//             { "address._id": addressId },
//             {
//                 $pull: {
//                     address: { _id: addressId }
//                 }
//             }
//         );
//         res.redirect("/userProfile");  // Redirect to user profile after deleting address
//     } catch (error) {
//         console.error("Error in delete address", error);
//         res.redirect("/pageNotFound");  // Redirect to error page if an error occurs
//     }
// };





const deleteAddress = async (req, res) => {
    try {
        const addressId = req.query.addressId;
        const userId = req.query.userId;

        console.log("Received user ID:", userId);
        console.log("Received address ID:", addressId);

        // Validate ObjectId format
        if (!ObjectId.isValid(addressId)) {
            console.error("Invalid address ID:", addressId);
            return res.json({ success: false, message: "Invalid address ID" });
        }

        // Find the document containing the address
        const findAddress = await Address.findOne({ "address._id": new ObjectId(addressId) });

        if (!findAddress) {
            console.error("Address not found:", addressId);
            return res.json({ success: false, message: "Address not found" });
        }

        console.log("Deleting address...");

        // Delete the address from the array
        await Address.updateOne(
            { "address._id": new ObjectId(addressId) },
            { $pull: { address: { _id: new ObjectId(addressId) } } }
        );

        console.log("Address deleted successfully.");
        res.json({ success: true });

    } catch (error) {
        console.error("Error in delete address", error);
        res.json({ success: false, message: "An error occurred" });
    }
};







module.exports={
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    editProfile,
    updatePassword,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress
   
}