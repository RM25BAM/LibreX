import { Heart, Star } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

interface PropertyCardProps {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  reviewCount: number;
  image: string;
  isSuperhostRare?: boolean;
  onPropertyClick: (id: string) => void;
}

const PropertyCard = ({
  id,
  title,
  location,
  price,
  rating,
  reviewCount,
  image,
  isSuperhostRare = false,
  onPropertyClick
}: PropertyCardProps) => {
  return (
    <Card 
      className="group cursor-pointer overflow-hidden shadow-soft hover:shadow-hover transition-all duration-300 transform hover:-translate-y-1"
      onClick={() => onPropertyClick(id)}
    >
      <div className="relative">
        <img
          src={image}
          alt={title}
          className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 bg-white/80 hover:bg-white"
          onClick={(e) => {
            e.stopPropagation();
            // Handle favorite toggle
          }}
        >
          <Heart className="h-4 w-4" />
        </Button>
        {isSuperhostRare && (
          <Badge className="absolute top-3 left-3 bg-white text-foreground">
            Superhost
          </Badge>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground">{location}</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Star className="h-4 w-4 fill-current text-yellow-400" />
            <span className="text-sm font-medium">{rating}</span>
            <span className="text-sm text-muted-foreground">({reviewCount})</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-lg">${price}</span>
            <span className="text-muted-foreground"> / night</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PropertyCard;