

const User=require("../../models/userSchema");
const env=require("dotenv").config()
const nodemailer=require("nodemailer");
const bcrypt=require("bcrypt");

const pageNotFound=async (req,res)=>{
    try{
       return res.render("page404");
    }catch(error){
      res.redirect("/pageNotFound");
    }
}



const loadHomepage=async (req,res)=>{
    try{
       return res.render("user/home");
    }catch(error){
      console.log("Home page not found");
      res.status(500).send("Server error")
    }
}

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){
  console.log("Email:", process.env.NODEMAILER_EMAIL);
console.log("Password:", process.env.NODEMAILER_PASSWORD ? "Loaded" : "Not Loaded");
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
     const info = await transporter.sendMail({
        from:process.env.NODEMAILER_EMAIL,
        to:email,
        subject:"Verify your account",
        text:`Your OTP is ${otp}`,
        html:`<b>Your OTP:${otp}</b>`
     })

     return info.accepted.length >0;


    }catch(error){
        console.error("Error sending email",error);
        return false;

    }
}

const loadSignup=async (req,res)=>{
  try{
     return res.render("user/signup");
  }catch(error){
    console.log("signup page not found");
    res.status(500).send("Server error")
  }
}
const Signup=async (req,res)=>{
 
  try{
    const {name,phone,email,password,cPassword}=req.body
    
    
    if(password !==cPassword){
        return res.render("user/signup",{message:"Passwords do not match"});  
    }
    const findUser=await User.findOne({email});
    
    
    if(findUser){
        return res.render("signup",{message:"User already exist with this email"})
    }
    const otp=generateOtp();
    
    
    const emailSent = await sendVerificationEmail(email,otp);
    
    
    if(!emailSent){
        return res.json("email-error")
    }
    req.session.userOtp = otp;
    req.session.userData= {name,phone,email,password};

    res.render("user/verify-otp");
   console.log("OTP Sent",otp);
   

    }catch(error){
     console.error("signup error",error);
     res.redirect("/pageNotFound")
    }
}

const securePassword = async (password)=>{
  try {
    const passwordHash=await bcrypt.hash(password,10)
    return passwordHash;
  } catch (error) {
    
  }
}

const verifyOtp=async (req,res)=>{
  try{
    const {otp}=req.body;
     console.log(otp);
     if(otp===req.session.userOtp){
      const user=req.session.userData
      const passwordHash=await securePassword(user.password);
      const saveUserData=new User({
        name:user.name,
        email:user.email,
        phone:user.phone,
        password:passwordHash,

      })
      await saveUserData.save();
      req.session.user=saveUserData.id;
      res.json({success:true,redirectUrl:"/"})
     }else{
      res.status(400).json({success:false,message:"Invalid Otp,Please try again"})
     }
  }catch(error){
    console.log("Error Verifying OTP",error);
    res.status(500).json({success:false,message:"An error occured"})
  }
}

// const loadLogin=async (req,res)=>{
//   try{
   
//      return res.render("login");
//   }catch(error){
//     console.log("Home page not found");
//     res.status(500).send("Server error")
//   }
// }
// const Login=async (req,res)=>{
//   const {email,password}=req.body
//   try{
//     const newUser= new User({email,password});
//     if(newUser) return res.redirect("/")
//   }catch(error){
//     console.log("Error for Save user",error);
//     res.status(500).send("Server error")
//   }
// }

const resendOtp=async(req,res)=>{
  try {
    const {email}=req.session.userData;
    if(!email){
      return res.status(400).json({succes:false,message:"Email not found in session"})
    }
    const otp=generateOtp();
    req.session.userData=otp;
    const emailSent=await sendVerificationEmail(email,otp);
    if(emailSent){
      console.log("Resend OTP:",otp);
      res.status(200).json({succes:true,message:"OTP Resend Successfully"});
    }else{
      res.status(500).json({succes:false,message:"Failed to resend OTP. Please try again"});
    }
    
  } catch (error) {

    console.log("Error resending OTP",error);
    res.status(500).json({success:false,message:"Internal Server Error. Please try again"});
    
  }
}



module.exports={
    loadHomepage,
    pageNotFound,
    loadSignup,
    Signup,
    verifyOtp,
    resendOtp
    // loadLogin,
    // Login
   

}

