import Link from 'next/link';

export default function PageHeader({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
        ← เครื่องมือทั้งหมด
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mt-2 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h1>
      <p className="text-gray-500 mt-1">{description}</p>
    </div>
  );
}
