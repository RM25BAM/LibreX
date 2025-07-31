
import React, { useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

const StickyScroll = () => {
    const content = [
        {
            title: "Escrow Without the Middleman",
            description:
                "LibreX replaces traditional escrow agents with smart contracts. Buyers can submit offers using stablecoins like USDT or ARP, and sellers can accept with confidence, knowing the funds are locked and released only when agreed milestones are met. This reduces costs, delays, and manual oversight.",
            content: (
                <img
                    src=""
                    alt="1"
                    className="w-full h-full object-cover"
                />
            ),
        },
        {
            title: "Borderless Property Transactions",
            description:
                "Whether you're buying land in Texas or renting an apartment in Buenos Aires, LibreX simplifies global real estate deals. By leveraging the XRP Ledger’s speed and finality, the platform ensures secure transactions that bypass currency conversion fees and regulatory bottlenecks.",
            content: (
                <img
                    src=""
                    alt="2"
                    className="w-full h-full object-cover"
                />
            ),
        },
        {
            title: "Smart, Secure, and Scalable",
            description:
                "The platform is built with React (web) and React Native (mobile), with blockchain logic handled entirely on-chain. Future features include on-chain offer ratings, buyer pre-approval tools for underbanked users, QR-based payments, and KYC-optional profiles — all with enterprise scalability in mind.",
            content: (
                <img
                    src=""
                    alt="3"
                    className="w-full h-full object-cover"
                />
            ),
        },
    ];

    const [activeCard, setActiveCard] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end end"],
    });

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        const index = Math.floor(latest * content.length);
        setActiveCard(Math.min(index, content.length - 1));
    });

    return (
        <div>
            <div className=" text-white place-content-left pt-20 ml-35 md:px-10">
                <h1 className="text-4xl md:text-6xl font-extrabold mt-10">Our Capabilities</h1>
                <p className="max-w-4xl mt-4 text-lg">
                    LibreX is a decentralized escrow platform for real estate transactions, designed to eliminate costly intermediaries and cross-border friction. Powered by the XRP Ledger and integrated with smart contracts on its EVM sidechain, LibreX enables buyers and sellers to create secure, trustless offers on-chain. With stablecoin support and a seamless digital interface, LibreX transforms the outdated, paperwork-heavy real estate process into a fast, transparent, and global experience.
                </p>
            </div>
            <div ref={ref} className="relative grid grid-cols-1 lg:grid-cols-2 gap-10  ml-35 p-4 md:p-10 text-white">
                <div className="flex flex-col">
                    {content.map((item, index) => (
                        <div key={index} className="h-screen flex flex-col justify-center items-start">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: activeCard === index ? 1 : 0.3 }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                            >
                                <h2 className="text-3xl md:text-4xl font-bold">{item.title}</h2>
                                <p className="mt-6 text-slate-300 text-lg md:text-xl max-w-md">
                                    {item.description}
                                </p>
                            </motion.div>
                        </div>
                    ))}
                </div>
                <div className="hidden lg:flex sticky top-0 h-screen items-center justify-center">
                    <div className="relative h-80 w-96 rounded-xl overflow-hidden shadow-xl border-4 border-amber-300">
                        {content.map((item, index) => (
                            <motion.div
                                key={item.title + index}
                                initial={{ opacity: 0, scale: 1.05 }}
                                animate={{
                                    opacity: activeCard === index ? 1 : 0,
                                    scale: activeCard === index ? 1 : 1.05,
                                }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                className="absolute inset-0 h-full w-full"
                            >
                                {item.content}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StickyScroll;