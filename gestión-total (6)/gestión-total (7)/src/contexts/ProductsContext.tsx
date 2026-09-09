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
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products in context:', error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    // Initial fetch from Supabase / cache immediately
    fetchProducts();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchProducts();
      }
    });
    return () => unsubscribe();
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
