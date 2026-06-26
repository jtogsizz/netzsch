import { redirect } from 'next/navigation';

export default async function DatabookDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?view=${id}`);
}
