import CartItem from './CartItem';

export default function Cart({ cartItems, onUpdateQuantity, totalPrice }) {
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
        <span className="mr-2">🛒</span>
        Your Order
      </h2>

      {cartItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">Your cart is empty</p>
          <p className="text-sm">Add items from the menu to get started</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
            {cartItems.map(item => (
              <CartItem
                key={item.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
              />
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-lg font-semibold">${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Tax (8%)</span>
              <span className="text-lg font-semibold">${(totalPrice * 0.08).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-800">Total</span>
                <span className="text-2xl font-bold text-red-600">
                  ${(totalPrice * 1.08).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

