

const User=require("../../models/userSchema");
const env=require("dotenv").config()
const nodemailer=require("nodemailer");

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
    const {email,password,cPassword}=req.body
    
    
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
    req.session.userData= {email,password};

    // res.render("Verify-otp");
   console.log("OTP Sent",otp);
   

    }catch(error){
     console.error("signup error",error);
     res.redirect("/pageNotFound")
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





module.exports={
    loadHomepage,
    pageNotFound,
    loadSignup,
    Signup,
    // loadLogin,
    // Login
   

}

