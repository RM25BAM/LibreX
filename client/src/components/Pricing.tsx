import SquishyCard from "../components/payment";
const Pricing = () => {
    return (
        <div className="w-screen h-auto">
            <div className="flex-row">
                <div>
                    <h1 className="text-center font-extrabold text-5xl pt-20 text-[#202124] pb-15">
                        Pricing
                    </h1>
                </div>
                <SquishyCard />
            </div>
        </div>
    )
}

export default Pricing