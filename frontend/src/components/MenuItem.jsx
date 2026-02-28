export default function MenuItem({ item, onAddToCart }) {
  return (
    <div className="card overflow-hidden group">
      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-gray-200">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=300&fit=crop';
          }}
        />
        <div className="absolute top-3 right-3 bg-white px-3 py-1 rounded-full shadow-md">
          <span className="text-red-600 font-bold text-lg">${item.price.toFixed(2)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{item.name}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{item.description}</p>
        
        <button
          onClick={() => onAddToCart(item)}
          className="w-full btn-primary flex items-center justify-center space-x-2"
        >
          <span>Add to Order</span>
          <span className="text-xl">+</span>
        </button>
      </div>
    </div>
  );
}

