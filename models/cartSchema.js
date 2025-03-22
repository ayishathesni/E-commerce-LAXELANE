const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
     userId: {      
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
    
        },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required:true

        },

        name: {
            
            type: String,
            required: true

        },
        size: {
            type: String,
            required: true
        },
        
        quantity: {
            
            type: Number,
            required:true,
            default: 1

        },

        price: {
             
            type: Number,
            required: true,
            default: 0


        },

    totalPrice: {
            
        type: Number,
        required: true,
        default: 0

    },
    status:{
        type:String,
        default:"placed"
    },
    cancellationReason:{
        type:String,
        default:"none"
    },
   
    }]
});

module.exports = mongoose.model('Cart', cartSchema);