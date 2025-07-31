"use client";
import { motion } from "framer-motion";

const cardData = [
    {
        title: "Starter",
        price: "Free",
        description: "Get started with basic property listings and smart contract offers—no setup fees.",
        bgColor: "bg-indigo-500",
        shape: "circle",
    },
    {
        title: "Teams",
        price: "$50/Month",
        description: "Collaborate with team members, manage multiple listings, and unlock advanced escrow tools.",
        bgColor: "bg-teal-500",
        shape: "square",
    },
    {
        title: "Enterprise",
        price: "Custom",
        description: "Scale globally with API access, analytics, priority support, and tailored blockchain integrations.",
        bgColor: "bg-amber-500",
        shape: "triangle",
    },
];


const SquishyCard = () => {
    return (
        <section className=" px-4 py-12">
            <div className="mx-auto flex flex-wrap justify-center gap-8">
                {cardData.map((card, index) => (
                    <Card key={index} {...card} />
                ))}
            </div>
        </section>
    );
};

const Card = ({ title, price, description, bgColor, shape }: any) => {
    return (
        <motion.div
            whileHover="hover"
            transition={{
                duration: 1,
                ease: "backInOut",
            }}
            variants={{
                hover: {
                    scale: 1.05,
                },
            }}
            className={`relative h-96 w-100 shrink-0 overflow-hidden rounded-xl ${bgColor} p-8`}
        >
            <div className="relative z-10 text-white">
                <span className="mb-3 block w-fit rounded-full bg-white/30 px-3 py-0.5 text-sm font-light text-white">
                    {title}
                </span>
                <motion.span
                    initial={{ scale: 0.85 }}
                    variants={{
                        hover: {
                            scale: 1,
                        },
                    }}
                    transition={{
                        duration: 1,
                        ease: "backInOut",
                    }}
                    className="my-2 block origin-top-left font-mono text-6xl font-black leading-[1.2]"
                >
                    {price}
                </motion.span>
                <p className="text-sm">{description}</p>
            </div>
            <button className="absolute bottom-4 left-4 right-4 z-20 rounded border-2 border-white bg-white py-2 text-center font-mono font-black uppercase text-neutral-800 backdrop-blur transition-colors hover:bg-white/30 hover:text-white">
                Get it now
            </button>
            <Background shape={shape} />
        </motion.div>
    );
};

const Background = ({ shape }: { shape: string }) => {
    return (
        <motion.svg
            width="320"
            height="384"
            viewBox="0 0 320 384"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 z-0"
            variants={{
                hover: {
                    scale: 1.5,
                },
            }}
            transition={{
                duration: 1,
                ease: "backInOut",
            }}
        >
            {shape === "circle" && (
                <>
                    <motion.circle
                        variants={{
                            hover: {
                                scaleY: 0.5,
                                y: -25,
                            },
                        }}
                        transition={{
                            duration: 1,
                            ease: "backInOut",
                            delay: 0.2,
                        }}
                        cx="160.5"
                        cy="114.5"
                        r="101.5"
                        fill="#262626"
                    />
                    <motion.ellipse
                        variants={{
                            hover: {
                                scaleY: 2.25,
                                y: -25,
                            },
                        }}
                        transition={{
                            duration: 1,
                            ease: "backInOut",
                            delay: 0.2,
                        }}
                        cx="160.5"
                        cy="265.5"
                        rx="101.5"
                        ry="43.5"
                        fill="#262626"
                    />
                </>
            )}
            {shape === "square" && (
                <motion.rect
                    x="60"
                    y="90"
                    width="200"
                    height="200"
                    fill="#1f2937"
                    variants={{
                        hover: {
                            rotate: 15,
                            scale: 1.1,
                        },
                    }}
                    transition={{ duration: 0.8, ease: "backInOut" }}
                />
            )}
            {shape === "triangle" && (
                <motion.polygon
                    points="160,50 270,300 50,300"
                    fill="#1f2937"
                    variants={{
                        hover: {
                            scale: 1.2,
                            rotate: 20,
                        },
                    }}
                    transition={{ duration: 0.8, ease: "backInOut" }}
                />
            )}
        </motion.svg>
    );
};

export default SquishyCard;
