import SquishyCard from "../components/payment";
const Pricing = () => {
    return (
        <div className="w-screen h-auto">
            <div className="flex-row">
                <div>
                    <h1 className="text-center font-extrabold text-7xl pt-20 text-white pb-15">Pricing</h1>
                </div>
                <SquishyCard />
            </div>
        </div>
    )
}

export default Pricing