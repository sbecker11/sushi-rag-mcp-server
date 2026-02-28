export default function CartItem({ item, onUpdateQuantity }) {
  const handleDecrease = () => {
    onUpdateQuantity(item.id, item.quantity - 1);
  };

  const handleIncrease = () => {
    if (item.quantity < 9) {
      onUpdateQuantity(item.id, item.quantity + 1);
    }
  };

  return (
    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
      <div className="flex-1 min-w-0 mr-3">
        <h4 className="font-semibold text-gray-800 truncate">{item.name}</h4>
        <p className="text-sm text-gray-600">${item.price.toFixed(2)} each</p>
      </div>

      <div className="flex items-center space-x-2">
        {/* Quantity Controls */}
        <div className="flex items-center space-x-1 bg-white rounded-lg shadow-sm">
          <button
            onClick={handleDecrease}
            className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-l-lg transition-colors font-bold text-xl"
            aria-label="Decrease quantity"
          >
            −
          </button>
          
          <div className="w-10 h-8 flex items-center justify-center border-x border-gray-200">
            <span className="font-semibold text-gray-800">{item.quantity}</span>
          </div>
          
          <button
            onClick={handleIncrease}
            disabled={item.quantity >= 9}
            className="w-8 h-8 flex items-center justify-center text-green-600 hover:bg-green-50 rounded-r-lg transition-colors font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        {/* Subtotal */}
        <div className="w-20 text-right">
          <span className="font-bold text-gray-800">
            ${(item.price * item.quantity).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

