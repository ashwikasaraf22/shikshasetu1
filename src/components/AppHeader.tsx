
'use client';

import Link from "next/link";
import { useAuth } from "./auth/AuthProvider";
import { Button } from "./ui/button";
import { ArrowLeft, User, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

type AppHeaderProps = {
    title: string;
    backLink?: string;
    children?: React.ReactNode;
}

export default function AppHeader({ title, backLink, children }: AppHeaderProps) {
    const { user } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await auth.signOut();
        router.push('/login');
    };

    const getInitials = (email: string | undefined) => {
        if (!email) return 'U';
        return email.substring(0, 2).toUpperCase();
    }

    return (
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center gap-4">
                       {backLink ? (
                            <Button asChild variant="ghost" size="icon">
                                <Link href={backLink}>
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                            </Button>
                       ) : (
                         <Link href="/" className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                            </svg>
                            <span className="font-bold hidden sm:inline-block">Shiksha Setu</span>
                        </Link>
                       )}
                    </div>

                    <h1 className="text-lg font-semibold text-foreground hidden md:block">
                        {title}
                    </h1>

                    <div className="flex items-center gap-4">
                        {children}
                        {user && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                        <Avatar className="h-9 w-9">
                                            {/* In a real app, you'd have user.photoURL */}
                                            <AvatarImage src="" alt={user.email} />
                                            <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuItem disabled>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.email}</p>
                                            <p className="text-xs leading-none text-muted-foreground capitalize">{user.role}</p>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => router.push('/profile')}>
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Profile</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={handleLogout}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Log out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
