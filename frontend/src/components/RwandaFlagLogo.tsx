type RwandaFlagLogoProps = {
  className?: string;
  size?: number;
};

export default function RwandaFlagLogo({ className = '', size = 48 }: RwandaFlagLogoProps) {
  return (
    <div
      aria-label="Rwanda national flag"
      title="Rwanda national flag"
      className={`relative overflow-hidden rounded-full border border-white/30 shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(90deg, #00A1DE 0 33%, #FAD201 33% 66%, #20603D 66% 100%)',
      }}
    >
      <div className="absolute inset-y-0 left-[33%] w-[34%] bg-white/75" />
      <div className="absolute inset-y-[18%] left-[38%] w-[24%] rounded-full bg-white/85" />
    </div>
  );
}
