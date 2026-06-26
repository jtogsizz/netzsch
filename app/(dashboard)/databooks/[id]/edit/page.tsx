import { redirect } from 'next/navigation';

export default async function DatabookEditRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?edit=${id}`);
}
