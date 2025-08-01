import { useMotionValue, motion, useSpring, useTransform, MotionValue } from "framer-motion";
import { useRef, type JSXElementConstructor, type Key, type ReactElement, type ReactNode, type ReactPortal } from "react";
import { FiArrowRight } from "react-icons/fi";
import smart from "../assets/smart.jpg";
import property from "../assets/property.jpg";
import career from "../assets/careers.jpg";
import contact from "../assets/contact.jpg";
export const Footer = () => {
    return (
        <section className="bg-black p-4 mb-4 md:p-8">
            <div className="mx-auto max-w-5xl space-y-6" >
                <Link
                    heading="How it Works"
                    subheading="Smart escrow, stablecoins, and more"
                    imgSrc={smart}
                    href="#"
                />
                <Link
                    heading="List a Property"
                    subheading="Create a listing and receive offers"
                    imgSrc={property}
                    href="#"
                />
                <Link
                    heading="Careers"
                    subheading="Join our mission to change real estate"
                    imgSrc={career}
                    href="#"
                />
                <Link
                    heading="Contact"
                    subheading="Let's talk partnerships or support"
                    imgSrc={contact}
                    href="/contact"
                />
            </div>
        </section>
    );
};

const Link = ({ heading, imgSrc, subheading, href }) => {
    const ref = useRef(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);

    const top = useTransform(mouseYSpring, [0.5, -0.5], ["40%", "60%"]);
    const left = useTransform(mouseXSpring, [0.5, -0.5], ["60%", "70%"]);

    const handleMouseMove = (e) => {
        const rect = ref.current.getBoundingClientRect();

        const width = rect.width;
        const height = rect.height;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;

        x.set(xPct);
        y.set(yPct);
    };

    return (
        <motion.a
            href={href}
            ref={ref}
            onMouseMove={handleMouseMove}
            initial="initial"
            whileHover="whileHover"
            className="group relative flex items-center justify-between border-b-2 border-neutral-700 py-4 transition-colors duration-500 hover:border-neutral-50 md:py-8"
        >
            <div>
                <motion.span
                    variants={{
                        initial: { x: 0 },
                        whileHover: { x: -16 },
                    }}
                    transition={{
                        type: "spring",
                        staggerChildren: 0.075,
                        delayChildren: 0.25,
                    }}
                    className="relative z-10 block text-4xl font-bold text-neutral-500 transition-colors duration-500 group-hover:text-neutral-50 md:text-6xl"
                >
                    {heading.split(" ").map((word, i) => (
                        <span key={i} className="inline-block mr-2">
                            <motion.span
                                variants={{
                                    initial: { x: 0 },
                                    whileHover: { x: 16 },
                                }}
                                transition={{ type: "spring" }}
                                className="inline-block"
                            >
                                {word}
                            </motion.span>
                        </span>
                    ))}
                </motion.span>

                <span className="relative z-10 mt-2 block text-base text-neutral-500 transition-colors duration-500 group-hover:text-neutral-50">
                    {subheading}
                </span>
            </div>

            <motion.img
                style={{
                    top,
                    left,
                    translateX: "-50%",
                    translateY: "-50%",
                }}
                variants={{
                    initial: { scale: 0, rotate: "-12.5deg" },
                    whileHover: { scale: 1, rotate: "12.5deg" },
                }}
                transition={{ type: "spring" }}
                src={imgSrc}
                className="absolute z-0 h-24 w-32 rounded-lg object-cover text-base block md:h-48 md:w-64"
                alt={`Image representing a link for ${heading}`}
            />

            <motion.div
                variants={{
                    initial: {
                        x: "25%",
                        opacity: 0,
                    },
                    whileHover: {
                        x: "0%",
                        opacity: 1,
                    },
                }}
                transition={{ type: "spring" }}
                className="relative z-10 p-4"
            >
                <FiArrowRight className="text-5xl text-neutral-50" />
            </motion.div>
        </motion.a>
    );
};