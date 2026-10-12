import type { Product } from '../types';

const adultClothingSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const kidsClothingSizes = ['2T', '3T', '4T', '5/6', '7/8', '10/12', '14/16'];
const mensShoeSizes = ['7', '8', '9', '10', '11', '12', '13'];
const womensShoeSizes = ['5', '6', '7', '8', '9', '10', '11'];
const kidsShoeSizes = ['10C', '11C', '12C', '13C', '1Y', '2Y', '3Y'];

const mensModel = '/images/model-menswear.jpg';
const womensModel = '/images/model-streetwear.jpg';
const kidsModel = '/images/model-kidswear.jpg';

export const products: Product[] = [
    {
        id: 'signature-scent',
        name: 'Signature Scent Cologne',
        description: 'A bold everyday scent with warm, confident character.',
        price: 68,
        category: 'Cologne',
        subcategory: 'Fragrance',
        audiences: ['Men', 'Women'],
        badge: 'THE SIGNATURE',
        imageUrl: '/images/st-lou-a-ville-perfume.jpg'
    },
    {
        id: 'studio-tee',
        name: 'Studio Essential Tee',
        description: 'A heavyweight black tee finished with the signature lion logo.',
        price: 38,
        category: 'Tops',
        subcategory: 'T-Shirts',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: mensModel,
        garmentColor: 'black',
        badge: 'FAN FAVORITE'
    },
    {
        id: 'silver-lion-jacket',
        name: 'Silver Lion Varsity Jacket',
        description: 'A statement black-and-silver layer with the lion on the chest.',
        price: 115,
        category: 'Outerwear',
        subcategory: 'Jackets',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: mensModel,
        garmentColor: 'black',
        badge: 'LIMITED DROP'
    },
    {
        id: 'producer-hoodie',
        name: 'Lightweight Studio Hoodie',
        description: 'A light charcoal layer for sessions, soundchecks, and the ride home.',
        price: 78,
        category: 'Tops',
        subcategory: 'Lightweight Hoodies',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: womensModel,
        garmentColor: 'charcoal'
    },
    {
        id: 'after-hours-cologne',
        name: 'After Hours Cologne',
        description: 'A smooth evening fragrance with a warm, unmistakable finish.',
        price: 74,
        category: 'Cologne',
        subcategory: 'Fragrance',
        audiences: ['Men', 'Women'],
        imageUrl: 'https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=900&q=85'
    },
    {
        id: 'stl-tee',
        name: 'STL Sound Tee',
        description: 'A clean silver tee featuring the St. Lou-a-ville lion.',
        price: 42,
        category: 'Tops',
        subcategory: 'T-Shirts',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: womensModel,
        garmentColor: 'silver'
    },
    {
        id: 'midnight-bomber',
        name: 'Midnight Bomber',
        description: 'A black bomber with gold lion details, built for studio-to-stage nights.',
        price: 128,
        category: 'Outerwear',
        subcategory: 'Jackets',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: mensModel,
        garmentColor: 'black'
    },
    {
        id: 'gold-record-sweats',
        name: 'Gold Record Crewneck',
        description: 'A relaxed charcoal crewneck with gold lion detailing.',
        price: 72,
        category: 'Tops',
        subcategory: 'Crewnecks',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: womensModel,
        garmentColor: 'charcoal'
    },
    {
        id: 'lion-tank',
        name: 'Lion Crest Tank',
        description: 'A black tank with a bold silver-and-gold logo for warm studio days.',
        price: 34,
        category: 'Tops',
        subcategory: 'Tanks',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: womensModel,
        garmentColor: 'black'
    },
    {
        id: 'gold-v-neck',
        name: 'Gold Standard V-Neck',
        description: 'A crisp bone-white V-neck with a gold lion crest.',
        price: 40,
        category: 'Tops',
        subcategory: 'V-Necks',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: womensModel,
        garmentColor: 'bone'
    },
    {
        id: 'heavyweight-hoodie',
        name: 'Heavyweight Lion Hoodie',
        description: 'A heavyweight black hoodie finished with the signature lion.',
        price: 92,
        category: 'Tops',
        subcategory: 'Heavyweight Hoodies',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: mensModel,
        garmentColor: 'black',
        badge: 'HEAVYWEIGHT'
    },
    {
        id: 'city-sound-shorts',
        name: 'City Sound Shorts',
        description: 'Easy charcoal shorts with a bright silver-and-gold lion mark.',
        price: 46,
        category: 'Bottoms',
        subcategory: 'Shorts',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: womensModel,
        garmentColor: 'charcoal'
    },
    {
        id: 'after-hours-sweatpants',
        name: 'After Hours Sweatpants',
        description: 'Black fleece sweats with a subtle gold lion crest.',
        price: 64,
        category: 'Bottoms',
        subcategory: 'Sweatpants',
        audiences: ['Men', 'Women'],
        sizes: adultClothingSizes,
        imageUrl: womensModel,
        garmentColor: 'black'
    },
    {
        id: 'junior-lion-tee',
        name: 'Junior Lion Tee',
        description: 'A soft everyday tee for the next generation of Slim fans.',
        price: 24,
        category: 'Tops',
        subcategory: 'T-Shirts',
        audiences: ['Kids'],
        sizes: kidsClothingSizes,
        imageUrl: kidsModel,
        garmentColor: 'black',
        badge: 'KIDS'
    },
    {
        id: 'junior-studio-hoodie',
        name: 'Junior Studio Hoodie',
        description: 'A cozy fleece layer with the signature lion mark.',
        price: 42,
        category: 'Tops',
        subcategory: 'Heavyweight Hoodies',
        audiences: ['Kids'],
        sizes: kidsClothingSizes,
        imageUrl: kidsModel,
        garmentColor: 'charcoal',
        badge: 'KIDS'
    },
    {
        id: 'junior-city-joggers',
        name: 'Junior City Joggers',
        description: 'Easy-moving fleece joggers made for every-day adventures.',
        price: 32,
        category: 'Bottoms',
        subcategory: 'Sweatpants',
        audiences: ['Kids'],
        sizes: kidsClothingSizes,
        imageUrl: kidsModel,
        garmentColor: 'black',
        badge: 'KIDS'
    },
    {
        id: 'city-lion-high-tops-men',
        name: 'City Lion High-Tops',
        description: 'A black-and-silver high-top sneaker with gold lion detailing.',
        price: 96,
        category: 'Shoes',
        subcategory: 'High-Tops',
        audiences: ['Men'],
        sizes: mensShoeSizes,
        garmentColor: 'black',
        badge: 'HIGH-TOP'
    },
    {
        id: 'city-lion-high-tops-women',
        name: 'City Lion High-Tops',
        description: 'A black-and-silver high-top sneaker with gold lion detailing.',
        price: 96,
        category: 'Shoes',
        subcategory: 'High-Tops',
        audiences: ['Women'],
        sizes: womensShoeSizes,
        garmentColor: 'black',
        badge: 'HIGH-TOP'
    },
    {
        id: '502-low-cuts-men',
        name: '502 Low-Cuts',
        description: 'A clean low-cut sneaker finished in silver, black, and gold.',
        price: 84,
        category: 'Shoes',
        subcategory: 'Low-Tops',
        audiences: ['Men'],
        sizes: mensShoeSizes,
        garmentColor: 'silver',
        badge: 'LOW-CUT'
    },
    {
        id: '502-low-cuts-women',
        name: '502 Low-Cuts',
        description: 'A clean low-cut sneaker finished in silver, black, and gold.',
        price: 84,
        category: 'Shoes',
        subcategory: 'Low-Tops',
        audiences: ['Women'],
        sizes: womensShoeSizes,
        garmentColor: 'silver',
        badge: 'LOW-CUT'
    },
    {
        id: 'junior-lion-high-tops',
        name: 'Junior Lion High-Tops',
        description: 'Little-kid and youth sizes with the signature lion detail.',
        price: 62,
        category: 'Shoes',
        subcategory: 'High-Tops',
        audiences: ['Kids'],
        sizes: kidsShoeSizes,
        garmentColor: 'black',
        badge: 'YOUTH'
    },
    {
        id: 'junior-lion-low-cuts',
        name: 'Junior Lion Low-Cuts',
        description: 'An easy-on low-cut sneaker in little-kid and youth sizes.',
        price: 54,
        category: 'Shoes',
        subcategory: 'Low-Tops',
        audiences: ['Kids'],
        sizes: kidsShoeSizes,
        garmentColor: 'silver',
        badge: 'YOUTH'
    },
    {
        id: '502-studio-set-men',
        name: '502 Studio Set',
        description: 'Three-piece bundle: lion tee, heavyweight hoodie, and matching high-tops.',
        price: 189,
        originalPrice: 226,
        category: 'Outfits',
        subcategory: 'Outfit',
        audiences: ['Men'],
        sizes: adultClothingSizes,
        imageUrl: mensModel,
        badge: 'BUNDLE · 3 PIECES'
    },
    {
        id: 'golden-hour-set-women',
        name: 'Golden Hour Set',
        description: 'A coordinated crewneck and jogger look, bundled together for less.',
        price: 109,
        originalPrice: 136,
        category: 'Outfits',
        subcategory: 'Outfit',
        audiences: ['Women'],
        sizes: adultClothingSizes,
        imageUrl: womensModel,
        badge: 'BUNDLE · 2 PIECES'
    },
    {
        id: 'junior-lion-outfit',
        name: 'Junior Lion Outfit',
        description: 'A junior tee, hoodie, and joggers bundled as one easy outfit.',
        price: 79,
        originalPrice: 98,
        category: 'Outfits',
        subcategory: 'Outfit',
        audiences: ['Kids'],
        sizes: kidsClothingSizes,
        imageUrl: kidsModel,
        badge: 'BUNDLE · 3 PIECES'
    }
];
