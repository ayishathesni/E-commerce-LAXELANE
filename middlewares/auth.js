const User = require("../models/userSchema")

const userAuth = async (req, res, next) => {
  try {
    if (req.path === "/login") {
      return next();
    }

    if (!req.session.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
            success: false,
            message: 'Please login to continue'
        });
    }
      return res.redirect("/login"); 
    }

    const user = await User.findById(req.session.user);
    if (!user || user.isBlocked) {
      req.session.destroy(); 
      return res.redirect("/login");
    }

    next(); 
  } catch (error) {
    console.error("Error in user auth middleware:", error);
    return res.status(500).send("Internal Server Error");
  }
};


const adminAuth=(req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
        next();
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in admin auth middleware",error);
        res.status(500).send("Internal Server Error")
    })
}

module.exports={
    userAuth,
    adminAuth
}