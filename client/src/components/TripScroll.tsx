import { useTransform, useScroll, motion } from "framer-motion";
import { useRef } from "react";

const TrippyScroll = () => {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  const rotate = useTransform(scrollYProgress, [0, 1], ["0deg", "90deg"]);

  return (
    <div ref={targetRef} className="relative z-0 h-[800vh] bg-[#9FE2BF]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="sticky top-0 h-screen"
      >
        <Trippy rotate={rotate} />
      </motion.div>
    </div>
  );
};

const NUM_SECTIONS = 25;
const PADDING = `${100 / NUM_SECTIONS / 2}vmin`;

const generateSections = (count, color, rotate) => {
  if (count === NUM_SECTIONS) {
    return <></>;
  }

  const nextColor = color === "#000000" ? "#9FE2BF" : "#000000"; 

  return (
    <Section rotate={rotate} background={color}>
      {generateSections(count + 1, nextColor, rotate)}
    </Section>
  );
};

const Trippy = ({ rotate }) => {
  return (
    <motion.div className="absolute inset-0 overflow-hidden">
      {generateSections(0, "#000000", rotate)}
    </motion.div>
  );
};

const Section = ({ background, children, rotate }) => {
  return (
    <motion.div
      className="relative h-full w-full origin-center"
      style={{
        background,
        rotate,
        padding: PADDING,
      }}
    >
      {children}
    </motion.div>
  );
};

export default TrippyScroll;
