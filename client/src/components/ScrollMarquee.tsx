import { motion, useAnimationFrame } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const Example = () => {
  return (
    <div className=" bg-neutral-950">
      <Marquee />
    </div>
  );
};

const Marquee = () => {
  const marqueeRef = useRef(null);
  const containerRef = useRef(null);
  const [scrollSpeed, setScrollSpeed] = useState(0);
  const baseSpeed = 0.8; // Base speed
  const position = useRef(0);
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY;
      setScrollSpeed(delta * 0.3); // tune multiplier 
      lastScrollY = currentY;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useAnimationFrame((_, delta) => {
    if (!containerRef.current) return;

    position.current -= (baseSpeed + scrollSpeed) * (delta / 16.67); 
    containerRef.current.style.transform = `translateX(${position.current % window.innerWidth}px)`;
  });

  return (
    <section
      ref={marqueeRef}
      className="relative h-48 overflow-hidden bg-black border-neutral-700"
    >
      <div className="absolute top-1/2 w-full -translate-y-1/2 transform">
        <div ref={containerRef} className="flex gap-4 whitespace-nowrap will-change-transform">
          {[...cards, ...cards].map((card, idx) => (
            <Card card={card} key={`${card.id}-${idx}`} />
          ))}
        </div>
      </div>
    </section>
  );
};

const Card = ({ card }) => {
  return (
    <div className="group relative h-[100px] w-[200px] overflow-hidden bg-neutral-200 shrink-0">
      <div
        style={{
          backgroundImage: `url(${card.url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        className="absolute inset-0 z-0 transition-transform duration-300 group-hover:scale-110"
      />
      <div className="absolute inset-0 z-10 grid place-content-center">
        <p className="bg-gradient-to-br from-white/20 to-white/0 p-0 text-3xl font-black uppercase text-white backdrop-blur-lg">
          {card.title}
        </p>
      </div>
    </div>
  );
};

export default Example;

const cards = [
  {
    url: "/imgs/abstract/1.jpg",
    title: "Title 1",
    id: 1,
  },
  {
    url: "/imgs/abstract/2.jpg",
    title: "Title 2",
    id: 2,
  },
  {
    url: "/imgs/abstract/3.jpg",
    title: "Title 3",
    id: 3,
  },
  {
    url: "/imgs/abstract/4.jpg",
    title: "Title 4",
    id: 4,
  },
  {
    url: "/imgs/abstract/5.jpg",
    title: "Title 5",
    id: 5,
  },
  {
    url: "/imgs/abstract/6.jpg",
    title: "Title 6",
    id: 6,
  },
  {
    url: "/imgs/abstract/7.jpg",
    title: "Title 7",
    id: 7,
  },
];
/* ill add the place holders taken from copy of the horizontal scroll btw */ 