export async function lookupProduct(barcode: string) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 1) {
      return {
        name: data.product.product_name || null,
        brand: data.product.brands || null,
        image: data.product.image_small_url || null,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}