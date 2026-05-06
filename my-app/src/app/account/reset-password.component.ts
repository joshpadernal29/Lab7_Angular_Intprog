// account/reset-password.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService, AlertService } from '@app/_services';
import { MustMatch } from '@app/_helpers';

enum TokenStatus {
    Validating,
    Valid,
    Invalid
}

@Component({ templateUrl: 'reset-password.component.html', standalone: false })
export class ResetPasswordComponent implements OnInit {
    TokenStatus = TokenStatus;
    tokenStatus = TokenStatus.Validating;
    token?: string;
    form!: FormGroup;
    loading = false;
    submitted = false;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService,
        private cd: ChangeDetectorRef // Added for manual UI refresh
    ) { }

    ngOnInit() {
        this.form = this.formBuilder.group({
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', Validators.required],
        }, {
            validator: MustMatch('password', 'confirmPassword')
        });

        const token = this.route.snapshot.queryParams['token'];
        console.log('DEBUG 1: Token from URL:', token);

        if (!token) {
            console.warn('DEBUG 1a: No token found. Setting to Invalid.');
            this.tokenStatus = TokenStatus.Invalid;
            return;
        }

        console.log('DEBUG 2: Calling validateResetToken service...');
        this.accountService.validateResetToken(token)
            .pipe(first())
            .subscribe({
                next: () => {
                    console.log('DEBUG 3: Success! Token is valid.');
                    this.token = token;
                    this.tokenStatus = TokenStatus.Valid;

                    // Force Angular to see the change and show the form
                    this.cd.detectChanges();

                    // Clean the URL
                    this.router.navigate([], { relativeTo: this.route, replaceUrl: true });
                },
                error: (err) => {
                    console.error("DEBUG 4: Component caught error:", err);
                    this.tokenStatus = TokenStatus.Invalid;
                    // Force Angular to show the error message
                    this.cd.detectChanges();
                }
            });
    }

    // convenience getter for easy access to form fields
    get f() { return this.form.controls; }

    onSubmit() {
        this.submitted = true;

        // reset alerts on submit
        this.alertService.clear();

        // stop here if form is invalid
        if (this.form.invalid) {
            return;
        }

        console.log('DEBUG 5: Submitting new password...');
        this.loading = true;
        this.accountService.resetPassword(this.token!, this.f['password'].value, this.f['confirmPassword'].value)
            .pipe(first())
            .subscribe({
                next: () => {
                    console.log('DEBUG 6: Password reset successful.');
                    this.alertService.success('Password reset successful, you can now login', { keepAfterRouteChange: true });
                    this.router.navigate(['../login'], { relativeTo: this.route });
                },
                error: error => {
                    console.error('DEBUG 7: Password reset failed.', error);
                    this.alertService.error(error);
                    this.loading = false;
                    this.cd.detectChanges();
                }
            });
    }
}
