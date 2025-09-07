interface Props {
  title: string;
  children: React.ReactNode;
}

export default function Card({ title, children }: Props) {
  return (
    <div className="bg-white shadow rounded p-4 mb-4">
      <h2 className="font-bold mb-2">{title}</h2>
      {children}
    </div>
  );
}