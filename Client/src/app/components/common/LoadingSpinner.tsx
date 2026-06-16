import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = 'black' 
}) => {
  const sizeMap = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const sizeClass = sizeMap[size];
  
  return (
    <div className="flex justify-center items-center">
      <div className={`${sizeClass} rounded-full animate-spin border-2 border-solid border-t-transparent`} 
           style={{ borderColor: `${color} transparent transparent transparent` }}>
      </div>
    </div>
  );
};

export default LoadingSpinner;