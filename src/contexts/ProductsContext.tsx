import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { inventoryService } from '../services/inventoryService';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface ProductsContextType {
  products: Product[];
  isLoading: boolean;
  refreshProducts: () => Promise<void>;
  getProductById: (id: string) => Product | undefined;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await inventoryService.getProducts();
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data);
      } else {
        // Fallback to local cache if getProducts returned empty
        const cached = localStorage.getItem('products');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProducts(parsed);
            }
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('Error fetching products in context:', error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    // 1. Always fetch products immediately on mount
    fetchProducts();

    // 2. Subscribe to realtime product changes
    let unsubscribeProducts: (() => void) | null = null;
    try {
      unsubscribeProducts = inventoryService.subscribeToProducts((updatedProducts) => {
        if (Array.isArray(updatedProducts) && updatedProducts.length > 0) {
          setProducts(updatedProducts);
        }
        setIsLoading(false);
        setIsInitialized(true);
      });
    } catch (e) {
      console.warn('Realtime products subscription notice:', e);
    }

    // 3. Listen to local product update events
    const handleProductsUpdated = () => {
      fetchProducts();
    };
    window.addEventListener('products_updated', handleProductsUpdated);
    window.addEventListener('storage', (e) => {
      if (e.key === 'products' || e.key === 'sb_cache_products') {
        fetchProducts();
      }
    });

    // 4. Also listen to Auth state changes to refresh user-specific data, but NEVER wipe products
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchProducts();
      }
    });

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
      unsubscribeAuth();
      window.removeEventListener('products_updated', handleProductsUpdated);
    };
  }, [fetchProducts]);

  const refreshProducts = async () => {
    await fetchProducts();
  };

  const getProductById = (id: string) => {
    return products.find(p => p.id === id);
  };

  return (
    <ProductsContext.Provider value={{ products, isLoading, refreshProducts, getProductById }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}
