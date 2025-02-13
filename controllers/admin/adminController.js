const User=require("../../models/userSchema");
const mongoose=require("mongoose");
const bcrypt=require("bcrypt");

const pageerror=async(req,res)=>{
    res.render("admin-error")
}


const loadLogin=async (req,res)=>{

      if(req.session.admin){
        return res.redirect("dashboard")
      }
      res.render("admin/login",{message:null})
  }


const login=async(req,res)=>{
    try{
        const {email,password}=req.body;
        console.log('hello');
        console.log('email',email);
        
        
        const admin=await User.findOne({email,isAdmin:true});
        console.log(admin)
        if(admin){
            const  passwordMatch=await bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin=true;
                console.log('byee');
                
                return res.redirect("/admin/dashboard")
            }else{
                console.log('nnmnmnm');
                
                return res.render("login",{message:'Invalid password'})
            }
        }else{
            console.log('dgfdgfd');
                
            return res.render("admin/login",{message:'Admin not found'})
        }
    }catch(error){
          console.log("login error");
          return res.redirect("/pagerror")
    }
}


const loadDashboard=async (req,res)=>{

    if(req.session.admin){
        try{
      res.render("admin/dashboard")
    }catch(error){
        res.redirect("/pageerror")
    }
} 
}


const logout=async(req,res)=>{
    try {
       req.session.destroy(err=>{
        if(err){
            console.log("Error destroying session",err);
            return res.redirect("/pageerror")
        }
        res.redirect("/admin/login")
       })
    } catch (error) {
        console.log(("unexpected error during logout",error));
        res.redirect("/pageerror")
        
    }
};




  module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,

  }