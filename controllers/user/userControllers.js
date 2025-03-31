
const User=require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env=require("dotenv").config();
const nodemailer=require("nodemailer");
const bcrypt=require("bcrypt");

const pageNotFound=async (req,res)=>{
    try{
       return res.render("user/page404");
    }catch(error){
      res.redirect("/pageNotFound");
    }
}




const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

    const categoryFilter = req.query.categories ? req.query.categories.split(',') : [];
    const colorFilter = req.query.colors ? req.query.colors.split(',') : [];
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : null;
    const sortBy = req.query.sortBy || 'createdAt_desc';

    const filter = { isBlocked: false };

    if (categoryFilter.length > 0) {
      const categories = await Category.find({ 
          name: { $in: categoryFilter.map(name => new RegExp(`^${name}$`, 'i')) },
          isListed: true 
      });
      if (categories.length > 0) {
          filter.category = { $in: categories.map(cat => cat._id) };
      } else {
          filter.category = null;
      }
  }
    if (colorFilter.length > 0) {
      filter.color = { $in: colorFilter };
    }

    if (maxPrice) {
      filter.salePrice = { $lte: maxPrice };
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);
    const skip = (page - 1) * limit;

  
    let sortOptions = {};
    switch (sortBy) {
     
      case 'price_asc':
        sortOptions = { salePrice: 1 };
        break;
      case 'price_desc':
        sortOptions = { salePrice: -1 };
        break;
     
    
      case 'new_arrivals':
        sortOptions = { createdAt: -1 };
        break;
      case 'name_asc':
        sortOptions = { productName: 1 };
        break;
      case 'name_desc':
        sortOptions = { productName: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const product = await Product.find(filter)
      .populate('category')
      .sort(sortOptions)
      .collation({ locale: 'en', strength: 2 })
      .skip(skip)
      .limit(limit);

    const allCategories = await Category.find({ isListed: true });
    const allColors = await Product.distinct('color', { isBlocked: false });

    res.render("user/shop", {
      product,
      login: user,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      lastPage: totalPages,
      allCategories,
      allColors,
      selectedCategories: categoryFilter,
      selectedColors: colorFilter,
      selectedMaxPrice: maxPrice || 5000,
      currentSort: sortBy
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
    if (!req.session.user) {
      return res.render("user/login", { message: req.flash('error') });
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
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error:", err);
        return res.render("user/login", { message: "User is blocked by admin" });
      });
      return;
    }

    if (findUser.password) {
      const passwordMatch = await bcrypt.compare(password, findUser.password);
      if (!passwordMatch) {
        req.flash('error', 'Incorrect Password');
        return res.redirect('/login');
      }
    } else {
      req.session.destroy();
      req.flash('error', 'Please log in using Google');
      return res.redirect('/login');
    }

    req.session.user = findUser;  
    res.redirect("/");
  } catch (error) {
    req.flash('error', 'Login failed. Please try again later');
    res.redirect('/login');
  }
};

const logout = async (req, res) => {
  try {
    req.session.user = null; 
    return res.redirect("/login");
  } catch (error) {
    console.log("Logout error", error);
    return res.redirect("/pageNotFound");
  }
};


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
    const findBrand = brand ? await Brand.findOne({ brandName: brand }) : null; 

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
    const maxPrice = parseInt(req.query.maxPrice) || 5000;
    const page = parseInt(req.query.page) || 1;
    const limit = 6;

    const filter = { 
      isBlocked: false,
      salePrice: { $lte: maxPrice }
    };
    
    if (req.query.categories) {
      const categoryNames = req.query.categories.split(',');
      const categories = await Category.find({ name: { $in: categoryNames } });
      filter.category = { $in: categories.map(cat => cat._id) };
    }
    
    if (req.query.colors) {
      filter.color = { $in: req.query.colors.split(',') };
    }
    
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);
    const skip = (page - 1) * limit;
    
    const products = await Product.find(filter)
      .populate('category')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    if (req.xhr) {
      return res.json({
        success: true,
        products,
        totalPages,
        currentPage: page
      });
    } else {
    
      const queryString = new URLSearchParams(req.query).toString();
      return res.redirect(`/shop?${queryString}`);
    }
  } catch (error) {
    console.error("Error in filterByPrice:", error);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: "Server error" });
    } else {
      return res.redirect("/pageNotFound");
    }
  }
};

const filterByCategory = async (req, res) => {
  try {
    const categoryNames = req.query.categories ? req.query.categories.split(',') : [];
    
    const queryParams = new URLSearchParams(req.query);
    return res.redirect(`/shop?${queryParams.toString()}`);
  } catch (error) {
    console.error("Error in filterByCategory:", error);
    res.redirect("/pageNotFound");
  }
};

const filterByColor = async (req, res) => {
  try {
    const colorNames = req.query.colors ? req.query.colors.split(',') : [];
    
    const queryParams = new URLSearchParams(req.query);
    return res.redirect(`/shop?${queryParams.toString()}`);
  } catch (error) {
    console.error("Error in filterByColor:", error);
    res.redirect("/pageNotFound");
  }
};

const applyFilters = async (req, res) => {
  try {

    const categories = req.query.categories ? req.query.categories.split(',') : [];
    const colors = req.query.colors ? req.query.colors.split(',') : [];
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : 5000;
    const page = parseInt(req.query.page) || 1;
    
 
    const queryParams = new URLSearchParams();
    
    if (categories.length > 0) queryParams.set('categories', categories.join(','));
    if (colors.length > 0) queryParams.set('colors', colors.join(','));
    if (maxPrice) queryParams.set('maxPrice', maxPrice.toString());
    queryParams.set('page', page.toString());
    
  
    return res.redirect(`/shop?${queryParams.toString()}`);
  } catch (error) {
    console.error("Error applying filters:", error);
    res.redirect("/pageNotFound");
  }
};


const clearFilters = async (req, res) => {
  return res.redirect('/shop');
};

const searchProducts = async (req, res) => {
  try {
   
    const searchQuery = req.query.q ? req.query.q.trim() : '';
    console.log("Search Query:", searchQuery);

    let userData = null;
    if (req.session.user) {
      userData = await User.findById(req.session.user);
    }


    let filter = {
      isBlocked: false,
      stock: { $gt: 0 }
    };

    if (searchQuery) {
      filter.productName = { $regex: new RegExp(searchQuery, 'i') };
    }

 
    const searchResults = await Product.find({
  productName: { $regex: new RegExp(searchQuery, 'i') },
  isBlocked: false
});

    console.log("Matched Products:", searchResults.length);

    const itemsPerPage = 9;
    const currentPage = parseInt(req.query.page) || 1;
    const totalPages = Math.ceil(searchResults.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    let paginatedProducts = searchResults.slice(startIndex, endIndex);


    const currentSort = req.query.sortBy || 'createdAt_desc';

    switch (currentSort) {
      case 'price_asc':
        paginatedProducts.sort((a, b) => a.salePrice - b.salePrice);
        break;
      case 'price_desc':
        paginatedProducts.sort((a, b) => b.salePrice - a.salePrice);
        break;
      case 'name_asc':
        paginatedProducts.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case 'name_desc':
        paginatedProducts.sort((a, b) => b.productName.localeCompare(a.productName));
        break;
      case 'new_arrivals':
      default:
        paginatedProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }


    res.render('user/shop', {
      product: paginatedProducts,
      user: userData,
      totalPages,
      currentPage,
      hasPrevPage: currentPage > 1,
      hasNextPage: currentPage < totalPages,
      prevPage: currentPage - 1,
      nextPage: currentPage + 1,
      currentSort,
      selectedCategories: req.query.categories ? req.query.categories.split(',') : [],
      selectedColors: req.query.colors ? req.query.colors.split(',') : [],
      selectedMaxPrice: req.query.maxPrice || '2500',
      searchQuery
    });

  } catch (error) {
    console.error("Search Error:", error);
    res.redirect("/pageNotFound");
  }
};










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
    filterByCategory,
    filterByColor,
    applyFilters,
    clearFilters,
  
    searchProducts

}

