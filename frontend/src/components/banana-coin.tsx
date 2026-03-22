import Image from "next/image";
import { cn } from "@/lib/utils";

export function BananaCoin({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/assets/bananacoin.webp"
      alt="banana coin"
      width={size}
      height={size}
      className={cn("inline-block", className)}
    />
  );
}
