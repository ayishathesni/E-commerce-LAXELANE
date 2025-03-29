
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema');
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { response } = require('express');
const mongoose = require ('mongoose')
const { ObjectId } = require("mongoose").Types;
const Order = require('../../models/orderSchema');








function generateOtp(){
    const digits="1234567890"
    let otp="";
    for(let i=0;i<6;i++){
       
        otp += digits.charAt(Math.floor(Math.random() * 10)); 
 
    }
    return otp;
}



const getForgotPassPage = async (req, res) => {
    try {
        res.render("user/forgot-password");
    } catch (error) {
        console.error("Error:", error);
        res.render("user/page404"); 
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





const userProfile = async (req, res) => {
    try {
        const userId = req.session.user?._id; 
        console.log("User ID:", userId);

        if (!userId) {
            req.flash('message', 'User not logged in.');
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        const addressData = await Address.findOne({ userId });
    
        const orders = await Order.find({ address: userId })
            .populate({
                path: 'orderItems.productId',
                select: 'productName price sizeVariants productImage'
            })
            .sort({ createdOn: -1 });

        res.render('user/profile', {
            userData,
            addresses: addressData ? addressData.address : [],
            orders: orders, 
            msgg: req.flash('message') || ''
        });
    } catch (error) {
        console.error("Error retrieving profile data:", error);
        res.redirect("/pageNotFound");
    }
};

const editProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const { name, phone } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: "Name and phone are required"
            });
        }

       
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format"
            });
        }

       
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

     
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All password fields are required"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

     
        const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New passwords do not match"
            });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"
            });
        }

    
        const hashedPassword = await securePassword(newPassword);

     
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



const addAddress = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        const addressData = await Address.findOne({ userId });

        res.render("user/add-address", { 
            userData, 
            addresses: addressData ? addressData.address : []  
        });

    } catch (error) {
        console.error("Error showing add address page", error);
        res.redirect("/pageNotFound");
    }
};




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




const editAddress = async (req, res) => {
    try {
        const addressId = req.query.id;  
        console.log("Received Address ID for editing:", addressId); 

        if (!addressId) {
            return res.status(400).json({ success: false, message: "No address ID provided" });
        }

        const user = req.session.user;  
        console.log("Logged-in user:", user); 

        if (!user) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        const mongoose = require('mongoose');
        const objectId = new mongoose.Types.ObjectId(addressId);

       
        const currAddress = await Address.findOne(
            { "address._id": objectId },
            { "address.$": 1 } 
        );

        console.log("Fetched address from DB:", currAddress); 

        if (!currAddress || !currAddress.address || currAddress.address.length === 0) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        const addressData = currAddress.address[0]; 
        res.json({ success: true, address: addressData });

    } catch (error) {
        console.error("Error in edit address:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};









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






const deleteAddress = async (req, res) => {
    try {
        const addressId = req.query.addressId;
        const userId = req.query.userId;


       
        if (!ObjectId.isValid(addressId)) {
            console.error("Invalid address ID:", addressId);
            return res.json({ success: false, message: "Invalid address ID" });
        }

    
        const findAddress = await Address.findOne({ "address._id": new ObjectId(addressId) });

        if (!findAddress) {
            console.error("Address not found:", addressId);
            return res.json({ success: false, message: "Address not found" });
        }

        await Address.updateOne(
            { "address._id": new ObjectId(addressId) },
            { $pull: { address: { _id: new ObjectId(addressId) } } }
        );

        res.json({ success: true });

    } catch (error) {
        console.error("Error in delete address", error);
        res.json({ success: false, message: "An error occurred" });
    }
};



const loadWallet = async (req, res) => {
    try {
      console.log("🔍 Loading Wallet...");
  
      // Check if user is authenticated (userAuth ensures this)
      if (!req.session.user) {
        console.log("❌ No user session found. Redirecting to login...");
        return res.redirect("/login");
      }
  
      console.log("✅ User ID from session:", req.session.user);
  
      // Fetch the user from the database
      const user = await User.findById(req.session.user);
      if (!user) {
        console.log("❌ User not found in database.");
        return res.status(404).json({ success: false, message: "User not found" });
      }
  
      console.log("💰 Wallet Balance:", user.wallet);
      console.log("📜 Wallet History:", user.walletHistory);
  
      // Render wallet page (or send JSON response if API request)
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, wallet: user.wallet, history: user.walletHistory });
      } else {
        return res.render("user/wallet", { userData: user });

      }
    } catch (error) {
      console.error("❌ Error loading wallet:", error);
      return res.status(500).send("Internal Server Error");
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
    deleteAddress,
    loadWallet
    
   
   
}