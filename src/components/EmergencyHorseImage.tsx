import Image from "next/image";
import horseImage from "@/assets/images/horse.png";
import horsePortrait from "@/assets/images/horse-portrait.jpg";

type Props = {
  name: string;
  imageUrl?: string | null;
  /** Tailwind size class for width/height, e.g. w-14 h-14 */
  sizeClass?: string;
  /** Use portrait fallback on public pages */
  portraitFallback?: boolean;
};

export default function EmergencyHorseImage({
  name,
  imageUrl,
  sizeClass = "w-14 h-14",
  portraitFallback = false,
}: Props) {
  const fallback = portraitFallback ? horsePortrait : horseImage;

  return (
    <div className={`emergency-horse-thumb shrink-0 ${sizeClass}`}>
      <div
        className="absolute emergency-horse-border-spin"
        style={{
          top: "-50%",
          left: "-50%",
          width: "200%",
          height: "200%",
          background:
            "conic-gradient(from 0deg, #ec4899, #f472b6 14%, #ffffff 20%, #ffffff 26%, transparent 32%, transparent 68%, #ffffff 74%, #ffffff 80%, #f472b6 86%, #ec4899)",
        }}
        aria-hidden
      />
      <div className="emergency-horse-thumb__inner">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Image src={fallback} alt={name} className="w-full h-full object-cover" />
        )}
      </div>
    </div>
  );
}
