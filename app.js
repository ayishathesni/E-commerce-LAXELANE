const express=require("express");
const app=express();
const flash = require('express-flash');
const path=require("path");
const passport=require("./config/passport");
const env=require("dotenv").config();
const session=require("express-session")
const db=require("./config/db");
const nocache = require("nocache")
const userRouter=require("./routes/userRouter");
const adminRouter=require("./routes/adminRouter");
db()

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))
//
app.use(flash());
app.use((req, res, next) => {
    res.locals.login = !!req.session.user;  
    res.locals.user = req.session.user || null;
    next();
  });

app.use(passport.initialize());
app.use(passport.session());


app.set("view engine","ejs");
app.set('views',
    path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname,"public")));

app.use(nocache())

app.use("/",userRouter);
app.use('/admin',adminRouter)

const port = process.env.PORT;
app.listen(port,()=>{
    console.log(`Server is running at port ${port}`)
})

app.use((req, res, next) => {
    res.status(404).render('user/page404');
});

console.log('Views directory:', app.get('views'));

module.exports=app;
