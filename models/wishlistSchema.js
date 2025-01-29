const mongoose = require('mongoose');
const {Schema}=mongoose;
const wishlistSchema = new Schema({
 
    userId: {      
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true

    },

    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required:true,
        },
        addedOn:{
            type:Date,
            default:Date.now
        }

    }]

});

module.exports = mongoose.model('Wishlist', wishlistSchema);