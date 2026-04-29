// _helpers/fake-backend.ts
import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse, HttpHandler, HttpEvent, HttpInterceptor, HTTP_INTERCEPTORS } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, materialize, dematerialize } from 'rxjs/operators';

import { AlertService } from '@app/_services';
import { Role } from '@app/_models';

// array in local storage for accounts
const accountsKey = 'angular-15-signup-verification-boilerplate-accounts';
let accounts: any[] = JSON.parse(localStorage.getItem(accountsKey)!) || [];

@Injectable()
export class FakeBackendInterceptor implements HttpInterceptor {
    constructor(private alertService: AlertService) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const { url, method, headers, body } = request;
        const alertService = this.alertService;

        return handleRoute();

        function handleRoute() {
            switch (true) {
                case url.endsWith('/accounts/authenticate') && method === 'POST':
                    return authenticate();
                case url.endsWith('/accounts/refresh-token') && method === 'POST':
                    return refreshToken();
                case url.endsWith('/accounts/revoke-token') && method === 'POST':
                    return revokeToken();
                case url.endsWith('/accounts/register') && method === 'POST':
                    return register();
                case url.endsWith('/accounts/verify-email') && method === 'POST':
                    return verifyEmail();
                case url.endsWith('/accounts/forgot-password') && method === 'POST':
                    return forgotPassword();
                case url.endsWith('/accounts/validate-reset-token') && method === 'POST':
                    return validateResetToken();
                case url.endsWith('/accounts/reset-password') && method === 'POST':
                    return resetPassword();
                case url.endsWith('/accounts') && method === 'GET':
                    return getAccounts();
                case url.match(/\/accounts\/\d+$/) && method === 'GET':
                    return getAccountById();
                case url.endsWith('/accounts') && method === 'POST':
                    return createAccount();
                case url.match(/\/accounts\/\d+$/) && method === 'PUT':
                    return updateAccount();
                case url.match(/\/accounts\/\d+$/) && method === 'DELETE':
                    return deleteAccount();
                default:
                    // pass through any requests not handled above
                    return next.handle(request);
            }
        }

        // route functions
        // account authentication function
        function authenticate() {
            const { email, password } = body;
            const account = accounts.find(x => x.email === email && x.password === password && x.isVerified);

            if (!account) return Error('Email or Password is Incorrect!');

            // add refresh tken to the account 
            account.refreshToken.push(generateRefreshToken());
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            return ok({
                ...basicDetails(account),
                jwtToken: generateJWTToken(account)
            });
        }
        // refresh token function
        function refreshToken() {
            const refreshToken = getRefreshToken();

            if (!refreshToken) return unauthorized();

            const account = accounts.find(x => x.refreshTokens.includes(refreshToken));

            if (!account) return unauthorized();

            // replace old refresh token with a new one and save
            account.refreshTokens = account.refreshTokens.filter((x: any) => x !== refreshToken);
            account.refreshTokens.push(generateRefreshToken());
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            return ok({
                ...basicDetails(account),
                jwtToken: generateJwtToken(account)
            });
        }
        // revoke token function
        function revokeToken() {
            if (!isAuthenticated()) return unauthorized();

            const refreshToken = getRefreshToken();
            const account = accounts.find(x => x.refreshTokens.includes(refreshToken));

            // revoke token and save
            account.refreshTokens = account.refreshTokens.filter((x: any) => x !== refreshToken);
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            return ok();
        }
        // register account function
        function register() {
            const account = body;

            if (accounts.find(x => x.email === account.email)) {
                // display email already registered "email" in alert
                setTimeout(() => {
                    alertService.info(`
                <h4>Email Already Registered</h4>
                <p>Your email ${account.email} is already registered.</p>
                <p>If you don't know your password please visit the <a href="${location.origin}/account/forgot-password">forgot password</a> page.</p>
                <div><strong>NOTE:</strong> The fake backend displayed this "email" so you can test without an api. A real backend would send a real email.</div>
            `, { autoClose: false });
                }, 100);

                // always return ok() response to prevent email enumeration
                return ok();
            }
            // assign account id and a few other properties then save
            account.id = newAccountId();
            if (account.id === 1) {
                // first registered account is an admin
                account.role = Role.Admin;
            } else {
                account.role = Role.User;
            }

            account.dateCreated = new Date().toISOString();
            account.verificationToken = new Date().getTime().toString();
            account.isVerified = false;
            account.refreshTokens = [];

            delete account.confirmPassword;
            accounts.push(account);
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            // display verification email in alert
            setTimeout(() => {
                const verifyUrl = `${location.origin}/account/verify-email?token=${account.verificationToken}`;
                alertService.info(`
            <h4>Verification Email</h4>
            <p>Thanks for registering!</p>
            <p>Please click the below link to verify your email address:</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>
            <div><strong>NOTE:</strong> The fake backend displayed this "email" so you can test without an api. A real backend would send a real email.</div>
        `, { autoClose: false });
            }, 1000);

            return ok();
        }

        // verify-email function
        function verifyEmail() {
            const { token } = body;
            const account = accounts.find(x => !!x.verificationToken && x.verificationToken === token);

            if (!account) return Error('Verification failed');

            // set verification flag to true if token is valid
            account.isVerified = true;
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            return ok();
        }

        // forgotPassword function
        function forgotPassword() {
            const { email } = body;
            const account = accounts.find(x => x.email === email);

            // always return ok() response to prevent email enumeration
            if (!account) return ok();

            // create reset token that expires after 24 hours
            account.resetToken = new Date().getTime().toString();
            account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            // display password reset email in alert
            setTimeout(() => {
                const resetUrl = `${location.origin}/account/reset-password?token=${account.resetToken}`;
                alertService.info(`
            <h4>Reset Password Email</h4>
            <p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <div><strong>NOTE:</strong> The fake backend displayed this "email" so you can test without an api. A real backend would send a real email.</div>
        `, { autoClose: false });
            }, 1000);

            return ok();
        }

        // validate resetToken function
        function validateResetToken() {
            const { token } = body;
            const account = accounts.find(x => !!x.resetToken && x.resetToken === token && new Date() < new Date(x.resetTokenExpires));

            if (!account) return Error('Invalid Token');

            return ok();
        }

        // resetPassword function
        function resetPassword() {
            const { token, password } = body;
            const account = accounts.find(x => !!x.resetToken && x.resetToken === token && new Date() < new Date(x.resetTokenExpires));

            if (!account) return Error('Invalid Token');

            //update password and remove reset token
            account.password = password;
            account.isVerified = true;
            delete account.resetToken;
            delete account.resetTokenExpires;
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            return ok();
        }

        // getAccounts function
        function getAccounts() {
            if (!isAuthenticated()) return unauthorized();

            let account = accounts.find(x => x.id === idFromUrl());

            // user accounts can get own profile and admin accounts cam get all profiles
            if (account.id !== currentAccount().id && !isAuthorized(Role.Admin)) {
                return unauthorized();
            }

            return ok(basicDetails(account));
        }

        // updateAccount function
        function updateAccount() {
            if (!isAuthenticated()) return unauthorized();

            let params = body;
            let account = accounts.find(x => x.id === idFromUrl());

            // user accounts can update own profile and admin accounts can update all profiles
            if (account.id !== currentAccount().id && !isAuthorized(Role.Admin)) {
                return unauthorized();
            }

            // only update password if included
            if (!params.password) {
                delete params.password;
            }

            // don't save confirm password
            delete params.confirmPassword;

            // update and save account
            Object.assign(account, params);
            localStorage.setItem(accountsKey, JSON.stringify(accounts));

            return ok(basicDetails(account));
        }

        // delete account function
        function deleteAccount() {
            if (!isAuthenticated()) return unauthorized();

            let account = accounts.find(x => x.id === idFromUrl());

            // user accounts can delete own account and admin accounts can delete any account
            if (account.id !== currentAccount().id && !isAuthorized(Role.Admin)) {
                return unauthorized();
            }

            // delete account then save
            accounts = accounts.filter(x => x.id !== idFromUrl());
            localStorage.setItem(accountsKey, JSON.stringify(accounts));
            return ok();
        }

        // helper functions



    }
}