# ST. LOU-A-VILLE SLIM

A responsive storefront for ST. LOU-A-VILLE SLIM, an independent Louisville, Kentucky music producer. Shop signature cologne, model-shot apparel, high-top and low-cut sneakers, and discounted outfits for men, women, and kids.

Built with React 19, TypeScript, Vite, Bun, and SQLite.

## Run locally

```bash
bun install
bun run dev
```

The combined development command starts the Bun API and the Vite storefront at [http://localhost:5173](http://localhost:5173). Create a production build with `bun run build`, run storefront and authorization tests with `bun run test`, and serve the production build with `bun run start`.

## Roles, accounts, and first-time admin setup

- Public sign-ups always create `customer` accounts. Customers can browse, add products to their bag, and submit their own unpaid demo order requests. A connected payment provider is required before orders can be charged or fulfilled as paid orders.
- `manager` and `admin` roles are checked on the server for every management API. Managers can update products, upload product photos, adjust inventory, edit store copy and announcements, and process orders. Only admins can create accounts, assign roles, delete products or uploaded images, and view the application audit log. The last administrator cannot be demoted or deleted.
- Login sessions use a seven-day, HTTP-only, SameSite=Strict cookie and CSRF tokens; passwords are stored as Argon2id hashes. Image uploads accept PNG, JPEG, and WebP files up to 5 MB; uploaded files are given generated names and are never treated as executable files.
- For the first administrator, run `.\scripts\bootstrap-admin.ps1 -Email "owner@example.com"` in PowerShell from the project folder. The script prompts for a password without echoing it, requires at least 16 characters, and creates the account in the selected store database without saving the password in `.env` or shell history. It uses `STORE_DB_PATH` when set, otherwise `data/store.sqlite`. Bootstrap cannot change an existing user's role. For hosted deployments, set the bootstrap values in the hosting provider's secret store instead of committing `.env`.
- The SQLite database is stored at `data/store.sqlite` by default and can be relocated with `STORE_DB_PATH`. Back up that file and `public/uploads/` together.
- Production deployment must use HTTPS and set `NODE_ENV=production`, plus the appropriate `HOST`, `PORT`, and `APP_ORIGIN` environment values. Server secrets, infrastructure configuration, source-code changes, and deployment remain hosting/developer operations; they are not editable from the store dashboard.

## Deploy on Railway

1. Create a Railway project from the `main` branch of this GitHub repository. Railway uses the included `Dockerfile` and `railway.toml`; the container listens on Railway's injected `PORT`.
2. Add a Railway volume mounted at `/data` before the first production deployment. The database and manager-uploaded images must remain on this persistent volume across deploys.
3. Generate the Railway public domain, then configure `APP_ORIGIN` to that exact HTTPS origin (for example, `https://your-store.up.railway.app`), and set `NODE_ENV=production`, `HOST=0.0.0.0`, `STORE_DB_PATH=/data/store.sqlite`, and `UPLOAD_DIR=/data/uploads`. Railway supplies `PORT`.
4. For the first deployment only, add `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` as Railway service variables. Use a unique password of at least 16 characters. After the service starts and the admin can sign in, remove both bootstrap variables and redeploy.
5. Check `https://your-store.up.railway.app/api/health`, sign in to the staff dashboard, and verify product images and uploads persist after a redeploy.

The deployed Railway database is separate from the local `data/store.sqlite`; the local administrator and local store changes do not transfer automatically. Checkout remains an unpaid demo request until a payment provider is integrated.

## Customize the shop

- Edit `src/data/products.ts` to change the initial catalog and sizes. After the database has been seeded, manage live product names, descriptions, prices, photos, and inventory from the authenticated staff dashboard.
- Edit `src/app/page.tsx` to change the garment group and subcategory filters.
- Local lifestyle-reference photos live in `public/images/model-menswear.jpg`, `public/images/model-streetwear.jpg`, and `public/images/model-kidswear.jpg`. Apparel cards show a branded concept preview with the lion mark overlaid on the model; these are not photographs of finished garments. Exact included bundle pieces and available sizes are listed with each product. Shoe product artwork is drawn in `src/components/ProductArtwork.tsx`.
- Apparel and shoe size selections are preserved as separate shopping-bag line items. Outfit bundle cards show the regular price, savings, and discounted bundle total.
- Edit `src/components/Header.tsx` and `src/components/Footer.tsx` to update the shop branding and links.
- The supplied lion-and-wordmark artwork is reused across the header, hero, and footer from `public/images/st-lou-a-ville-logo.png`. A lion-only crop of the supplied emblem marks apparel concept previews in `public/images/st-lou-a-ville-lion-mark.png`; `src/components/LionMark.tsx` and `src/components/BrandLogo.tsx` share the full artwork.
- Replace `public/images/st-lou-a-ville-perfume.jpg` to change the supplied cologne photo.
- Adjust storefront styling in `src/app/store.css`.
- Change the producer bio and shop introduction in `src/app/page.tsx`.

The dashboard keeps role-protected orders and inventory in SQLite. Checkout currently creates an explicitly unpaid demo order request; connect a payment provider and configure fulfilment before taking live paid orders. Product photography is loaded from Unsplash.