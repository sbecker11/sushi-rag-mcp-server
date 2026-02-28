import { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './components/Header';
import MenuGrid from './components/MenuGrid';
import OrderForm from './components/OrderForm';
import Cart from './components/Cart';
import OrderSuccess from './components/OrderSuccess';
import AIAssistant from './components/AIAssistant';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [menuItems, setMenuItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  // Fetch menu items on component mount
  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/menu`);
      setMenuItems(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching menu:', err);
      // Show more specific error if API key is not configured
      if (err.response?.status === 503) {
        setError(err.response.data.error || 'AI features are not configured. Please set up your OpenAI API key.');
      } else {
        setError('Failed to load menu. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Add item to cart or increase quantity
  const addToCart = (menuItem) => {
    const existingItem = cartItems.find(item => item.id === menuItem.id);
    
    if (existingItem) {
      // Increase quantity if less than 9
      if (existingItem.quantity < 9) {
        setCartItems(cartItems.map(item =>
          item.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }
    } else {
      // Add new item with quantity 1
      setCartItems([...cartItems, { ...menuItem, quantity: 1 }]);
    }
  };

  // Update item quantity
  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity === 0) {
      // Remove item if quantity is 0
      setCartItems(cartItems.filter(item => item.id !== itemId));
    } else if (newQuantity >= 1 && newQuantity <= 9) {
      // Update quantity if between 1 and 9
      setCartItems(cartItems.map(item =>
        item.id === itemId
          ? { ...item, quantity: newQuantity }
          : item
      ));
    }
  };

  // Calculate total price
  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Submit order
  const submitOrder = async (customerInfo) => {
    try {
      const orderData = {
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        phone: customerInfo.phone,
        creditCard: customerInfo.creditCard,
        items: cartItems.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalPrice: calculateTotal()
      };

      const response = await axios.post(`${API_URL}/api/orders`, orderData);
      setSubmittedOrder(response.data);
      setOrderSubmitted(true);
      setCartItems([]);
      return true;
    } catch (err) {
      console.error('Error submitting order:', err);
      
      // Extract detailed error information from the response
      let errorMessage = 'Failed to submit order. Please try again.';
      let errorCode = null;
      let errorField = null;
      
      if (err.response?.data) {
        const errorData = err.response.data;
        
        // Use the specific error message from backend
        if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        // Include error code if available
        if (errorData.code) {
          errorCode = errorData.code;
        }
        
        // Include field information if available
        if (errorData.field) {
          errorField = errorData.field;
        }
        
        // Add development details if available
        if (errorData.details && import.meta.env.DEV) {
          console.error('Error details:', errorData.details);
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = 'Unable to reach the server. Please check your internet connection and try again.';
        errorCode = 'NETWORK_ERROR';
      } else if (err.message) {
        // Something else went wrong
        errorMessage = err.message;
      }
      
      // Create error object with additional context
      const error = new Error(errorMessage);
      error.code = errorCode;
      error.field = errorField;
      error.statusCode = err.response?.status;
      
      throw error;
    }
  };

  // Reset to order again
  const resetOrder = () => {
    setOrderSubmitted(false);
    setSubmittedOrder(null);
  };

  if (orderSubmitted && submittedOrder) {
    return <OrderSuccess order={submittedOrder} onNewOrder={resetOrder} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-center">
            <p className="font-semibold">{error}</p>
            <button 
              onClick={fetchMenu}
              className="mt-3 btn-primary"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Menu Section - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Our Menu</h2>
                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                  <span className="text-lg">🤖</span>
                  <span className="text-sm font-semibold text-blue-800">
                    AI Generated Menu
                  </span>
                </div>
              </div>
              <MenuGrid menuItems={menuItems} onAddToCart={addToCart} />
            </div>

            {/* Order Section - Takes 1 column on large screens */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                <Cart 
                  cartItems={cartItems}
                  onUpdateQuantity={updateQuantity}
                  totalPrice={calculateTotal()}
                />
                
                {cartItems.length > 0 && (
                  <OrderForm 
                    onSubmit={submitOrder}
                    totalPrice={calculateTotal()}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* AI Assistant Chat */}
      <AIAssistant />
    </div>
  );
}

export default App;

