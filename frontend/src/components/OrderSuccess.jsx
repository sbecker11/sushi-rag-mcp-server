export default function OrderSuccess({ order, onNewOrder }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="card p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-5xl">✓</span>
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Order Confirmed!
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Thank you for your order, {order.first_name}!
          </p>

          {/* Order Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <div>
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="text-xl font-bold text-gray-800">#{order.id.toString().padStart(6, '0')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Order Date</p>
                <p className="text-sm font-semibold text-gray-800">{formatDate(order.created_at)}</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <h3 className="font-semibold text-gray-800 mb-3">Customer Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Name</p>
                  <p className="font-semibold">{order.first_name} {order.last_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Phone</p>
                  <p className="font-semibold">{order.phone}</p>
                </div>
              </div>
            </div>

            {order.items && order.items.length > 0 && (
              <div className="mb-4 pt-4 border-t">
                <h3 className="font-semibold text-gray-800 mb-3">Order Items</h3>
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {item.quantity}x {item.item_name}
                      </span>
                      <span className="font-semibold text-gray-800">
                        ${item.subtotal}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-800">Total Paid</span>
                <span className="text-2xl font-bold text-green-600">
                  ${parseFloat(order.total_price * 1.08).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Estimated Time */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              ⏱️ Estimated preparation time: <span className="font-bold">20-30 minutes</span>
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={onNewOrder}
            className="btn-primary text-lg py-3 px-8"
          >
            Place Another Order
          </button>
        </div>
      </div>
    </div>
  );
}

