import MenuItem from './MenuItem';

export default function MenuGrid({ menuItems, onAddToCart }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {menuItems.map(item => (
        <MenuItem 
          key={item.id}
          item={item}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}

