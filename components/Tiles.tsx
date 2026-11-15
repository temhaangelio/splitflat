/**
 * Logo: panodaki hücrelerin durağan, küçük hali. Boyutu, verilen yazı tipi
 * boyutundan (em) gelir; Hakkında sayfasının başlığında ve panonun altındaki
 * marka yazısında kullanılır.
 */
export default function Tiles({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span aria-hidden className={`flex gap-[.09em] ${className}`}>
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="relative grid h-[1.3em] w-[.86em] place-items-center bg-linear-to-b from-flap-hi to-flap font-bold shadow-[0_0_0_1px_var(--color-slot)] after:absolute after:inset-x-0 after:top-[calc(50%-.5px)] after:h-px after:bg-hinge after:content-['']"
        >
          <span className="text-[.8em] leading-none">{ch}</span>
        </span>
      ))}
    </span>
  );
}
