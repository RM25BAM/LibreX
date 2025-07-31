"use client";

import {
  motion,
  useScroll,
  useVelocity,
  useTransform,
  useSpring,
  useMotionValueEvent,
} from "framer-motion";
import { useRef, useEffect, useState } from "react";

export const VelocityText = () => {
  const targetRef = useRef(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (textRef.current) {
      setTextWidth(textRef.current.scrollWidth);
    }
  }, []);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"],
  });

  const scrollVelocity = useVelocity(scrollYProgress);

  const skewXRaw = useTransform(
    scrollVelocity,
    [-0.5, 0.5],
    ["45deg", "-45deg"]
  );
  const skewX = useSpring(skewXRaw, { mass: 3, stiffness: 200, damping: 50 });

  const xRaw = useTransform(scrollYProgress, [0, 1], [0, -textWidth]);
  const x = useSpring(xRaw, { mass: 3, stiffness: 400, damping: 50 });

  return (
    <section
      ref={targetRef}
      className="h-[1000vh] bg-black text-neutral-50"
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.p
          ref={textRef}
          style={{ skewX, x }}
          className="origin-bottom-left whitespace-nowrap text-5xl font-black uppercase leading-[0.85] md:text-7xl md:leading-[0.85]"
        >
          Real estate shouldn't move at the speed of paperwork. For too long, buying or selling property has meant delays, middlemen, and outdated systems. We're changing that by bringing escrow on-chain, we remove friction, reduce costs, and give buyers and sellers the power to move forward—securely, transparently, and without borders.
        </motion.p>
      </div>
    </section>
  );
};
