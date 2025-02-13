
const User=require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env=require("dotenv").config();
const nodemailer=require("nodemailer");
const bcrypt=require("bcrypt");

const pageNotFound=async (req,res)=>{
    try{
       return res.render("page404");
    }catch(error){
      res.redirect("/pageNotFound");
    }
}

// const loadShoppingPage = async (req,res) => {
//   try {
//     const user = req.session.user;
   

//     const product = await Product.find({isBlocked:false}).populate('category')    
    
//     res.render("user/shop",{
//       product:product,
    
//       login:user
//     })
//   } catch (error) {
//     res.redirect("/pageNotFound")
//   }
  
// }

const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1; 
    const limit = 6; 
    
   
    const totalProducts = await Product.countDocuments({isBlocked: false});
    const totalPages = Math.ceil(totalProducts / limit);
    
    const skip = (page - 1) * limit;
    
    const product = await Product.find({isBlocked: false})
      .populate('category')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });  
    
    res.render("user/shop", {
      product,
      login: user,
      currentPage: page,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      lastPage: totalPages
    });
  } catch (error) {
    console.error('Shopping page error:', error);
    res.redirect("/pageNotFound");
  }
};



const loadHomepage = async (req, res) => {
  try {
    const Categories = await Category.find({isListed: true});
    let ProductData = await Product.find({
      isBlocked: false,
      category: {$in: Categories.map(category => category._id)},
      quantity: {$gt: 0}
    });

    res.render("user/home", {
      user: req.session.user || null,
      products: ProductData,
      login: !!req.session.user 
    });
    
  } catch (error) {
    console.log("Home page not found");
    res.status(500).send("Server error");
  }
};



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
     if(req.session.user){
      res.redirect('/')
     } else {
      return res.render("user/signup");
     }
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
        return res.render("user/signup",{message:"User already exist with this email"})
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
        googleId:user.email

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

const loadLogin = async (req, res) => {
  try {
    let message = req.query.message || "";
    if (!req.session.user) {
      return res.render("user/login", { message });
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};




const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ email: email, isAdmin: false });

    if (!findUser) {
      return res.render("user/login", { message: "User not found" });
    }

    if (findUser.isBlocked) {
      req.session.destroy();
      return res.render("user/login", { message: "User is blocked by admin" });
    }

    if (findUser.password) {
      const passwordMatch = await bcrypt.compare(password, findUser.password);
      if (!passwordMatch) {
        return res.render("user/login", { message: "Incorrect Password" });
      }
    } else {
      req.session.destroy();
      return res.render("user/login", { message: "Please log in using Google" });
    }

    req.session.user = findUser;  
    res.redirect("/");
  } catch (error) {
    res.render("user/login", { message: "Login failed. Please try again later" });
  }
};


const logout=async (req,res)=>{
  try {
    req.session.destroy((err)=>{
      if(err){
        console.log("Session destruction error",err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login");
    })
  } catch (error) {
    console.log("Logout error",error)
    return res.redirect("/pageNotFound");
    
  }
}


const resendOtp = async(req, res) => {
  try {
    const {email} = req.session.userData;
    if(!email){
      return res.status(400).json({success: false, message: "Email not found in session"});
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    console.log('req.session.userOtp', req.session.userOtp);
    const emailSent = await sendVerificationEmail(email, otp);

    console.log("emailSent from resend otp", emailSent);

    if(emailSent){
      console.log("Resend OTP:", otp);
      return res.status(200).json({success: true, message: "OTP Resent Successfully"});
    } else {
      return res.status(500).json({success: false, message: "Failed to resend OTP. Please try again"});
    }
    
  } catch (error) {
    console.log("Error resending OTP", error);
    res.status(500).json({success: false, message: "Internal Server Error. Please try again"});
  }
}






const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const category = req.query.category;
    const brand = req.query.brand;
    
    const findCategory = category ? await Category.findOne({ _id: category }) : null;
    const findBrand = brand ? await Brand.findOne({ brandName: brand }) : null; // FIXED: Defined findBrand

    const brands = await Brand.find({}).lean();
    const query = {
      isBlocked: false,
      quantity: { $gt: 0 }
    };

    if (findCategory) {
      query.category = findCategory._id;
    }
    if (findBrand) {
      query.brand = findBrand.brandName;
    }

    let findProducts = await Product.find(query).lean();
    findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    const categories = await Category.find({ isListed: true });

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    let userData = null;
    if (user) {
      userData = await User.findOne({ _id: user });
      if (userData) {
        const searchEntry = {
          category: findCategory ? findCategory._id : null,
          brand: findBrand ? findBrand.brandName : null,
          searchedOn: new Date(),
        };
        userData.searchHistory.push(searchEntry);
        await userData.save();
      }
    }

    req.session.filteredProducts = currentProduct;
    res.render("shop", {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      selectedCategory: category || null,
      selectedBrand: brand || null, 
    });

  } catch (error) {
    console.error("Error in filterProduct:", error);
    res.redirect("/pageNotFound");
  }
};

const filterByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();

    let findProducts = await Product.find({
      salePrice: { $gt: req.query.lt }, // Filter by price
      isBlocked: false,
      quantity: { $gt: 0 }
    }).lean();

    findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    res.json({
      success: true,
      user: userData,
      products: currentProduct,
      categories,
      brands,
      totalPages,
      currentPage,
    });

  } catch (error) {
    console.error("Error in filterByPrice:", error);
    res.status(500).json({ success: false, message: "Server error" }); 
  }
};





const searchProducts = async(req,res)=>{
  try {
    const user = req.session.user;
    const userData = await User.findOne({_id:user});
    let search = req.body.query;

    const brands = await Brand.find({}).lean();
    const Categories = await Category.find({isListed:true}).lean();
    const categoryIds = categories.map(category=>category._id.toString());
    let searchResults = [];
    if(req.session.filteredProducts && req.session.filteredProducts.length>0){
      searchResult = req.session.filteredProducts.filter(product=>
        product.productName.toLowerCase().includes(search.toLowerCase())
      )
    }else{
      searchResults = await Product.find({
        productName : {$regex:".*"+search+".*",$options:"i"},
        isBlocked:false,
        quantity:{$gt:0},
        category:{$in:categoryIds}
      })
    }
    
    searchResults.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex  = (currentPage -1)*itemsPerPage;
    let endIndex = startIndex+itemsPerPage;
    let totalPages = Math.ceil(searchResults.length/itemsPerPage);
    const currentProduct = searchResults.slice(startIndex,endIndex);
   
    res.render("shop",{
      user:userData,
      products:currentProduct,
      category:categories,
      brand:brands,
      totalPages,
      currentPage,
      count:searchResult.length,
    })
    
  } catch (error) {
    console.log("Error:",error);
    res.redirect("/pageNotFound")
  }
}


module.exports={
    loadHomepage,
    pageNotFound,
    loadSignup,
    Signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts
   

}

