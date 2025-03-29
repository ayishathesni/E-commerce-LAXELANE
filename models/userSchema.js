    const mongoose=require("mongoose");
    const {Schema}=mongoose;


    const userSchema=new Schema({
        name:{
            type:String,
            required:true
        },
        email:{
            type:String,
            required:true,
            unique:true,
        },
        phone:{
            type:Number,
            required:false,
            unique:false,
            sparse:true,
            default:null
        },
        googleId:{
            type:String,
            unique:true,
            index: true,
            sparse: true,
            default: undefined
            },
        password:{
            type:String,
            required:false
            },
        isBlocked:{
                type:Boolean,
                default:false,
            },
        isAdmin:{
                type:Boolean,
                default:false
            },
        cart:[{
            type:Schema.Types.ObjectId,
            ref:"Cart",
        }],
        wallet:{
            type:Number,
            default:0,
        },

        walletHistory: [{
            transactionId: String,
            date: {
                type: Date,
                default: Date.now
            },
            type: {
                type: String,
                enum: ["credit", "debit"],
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            status: {
                type: String,
                enum: ["Completed", "Pending"],
                default: "Completed"
            }
        }],
        wishlist:[{
            type:Schema.Types.ObjectId,
            ref:"Wishlist",
        }],
        orderHistory:[{
            type:Schema.Types.ObjectId,
            ref:"Order",
        }],
        
        referalCode:{
            type:String
        },
        redeemed:{
            type:Boolean,
            default: false,
        },
        redeemedUsers:[{
            type:Schema.Types.ObjectId,
            ref:"User",
        }],
        searchHistory:[{
            category:{
                type:Schema.Types.ObjectId,
                ref:"Category",
            },
            brand:{
                type:String
            },
            searchOn:{
                type:Date,
                default:Date.now
            },
        },
    ],
    },
        {
            timestamps: true,
        }
    );

    const User=mongoose.model("User",userSchema);

    module.exports=User;
