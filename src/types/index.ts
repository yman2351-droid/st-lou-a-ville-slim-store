export type ProductCategory = 'Cologne' | 'Tops' | 'Bottoms' | 'Outerwear' | 'Shoes' | 'Outfits';

export type ProductAudience = 'Men' | 'Women' | 'Kids';

export type UserRole = 'admin' | 'manager' | 'customer';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled';

export type ProductSubcategory =
    | 'T-Shirts'
    | 'Tanks'
    | 'V-Necks'
    | 'Crewnecks'
    | 'Lightweight Hoodies'
    | 'Heavyweight Hoodies'
    | 'Shorts'
    | 'Sweatpants'
    | 'Jackets'
    | 'High-Tops'
    | 'Low-Tops'
    | 'Outfit'
    | 'Fragrance';

export type ApparelColor = 'black' | 'charcoal' | 'silver' | 'gold' | 'bone';

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    imageUrl?: string;
    category: ProductCategory;
    subcategory: ProductSubcategory;
    audiences: ProductAudience[];
    sizes?: string[];
    garmentColor?: ApparelColor;
    badge?: string;
    stockQuantity?: number | null;
    availableForSale?: boolean;
}