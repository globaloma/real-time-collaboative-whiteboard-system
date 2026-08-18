import type { Metadata } from "next";
import { BoardWorkspace } from "@/components/board-workspace";

type SearchParams = Record<string, string | string[] | undefined>;

function readFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

type BoardPageProps = {
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ searchParams }: BoardPageProps): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const roomId = (readFirst(resolvedParams?.room) ?? "DEMO-ROOM").trim();

  return { title: `${roomId} — Board` };
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const resolvedParams = await searchParams;
  const roomId = (readFirst(resolvedParams?.room) ?? "DEMO-ROOM").trim();
  const username = (readFirst(resolvedParams?.username) ?? "Guest").trim();

  return <BoardWorkspace roomId={roomId} username={username} />;
}