import FlipFadeText from './FlipFadeText'
import AsciiFire from './AsciiFire'

export default function UnleashFire() {
  return (
    <section className="relative w-full py-48 md:py-48 flex items-center justify-center overflow-hidden bg-black">
      {/* The ASCII Fire Background */}
      <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen pointer-events-none">
        <AsciiFire
          style={{ width: '100%', height: '100%' }}
          decay={20}
          palette="custom"
          shades={[
            "#022b10", // Darkest green
            "#054d1d",
            "#0b8f36",
            "#14c44f",
            "#2be36a",
            "#6bf79e",
            "#baffd6", // Lightest green/white
          ]}
          sparkColor="#e0ffeb"
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 flex justify-center text-white">
        <FlipFadeText 
          text="Unleash your fire." 
          className="font-display text-[clamp(4rem,12vw,10rem)] font-black uppercase tracking-tighter text-center leading-[0.9]" 
        />
      </div>
    </section>
  )
}
