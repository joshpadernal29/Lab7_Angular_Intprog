// _models/account.ts
import { Role } from './role';

export class Account {
    id?: string;
    title?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    role?: Role;
    jwtToken?: string
}