import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Subject, Subscription } from 'rxjs';
import { JhiEventManager } from 'ng-jhipster';

import { JhiHealthService } from 'app/admin/health/health.service';

import { VERSION } from 'app/app.constants';
import { EurekaStatusService } from './eureka.status.service';
import { ProfileService } from 'app/layouts/profiles/profile.service';
import { LoginOAuth2Service } from 'app/shared/oauth2/login-oauth2.service';
import { LoginModalService } from 'app/core/login/login-modal.service';
import { AccountService } from 'app/core/auth/account.service';
import { Account } from 'app/core/user/account.model';
import { JhiApplicationsService } from 'app/registry/applications/applications.service';
import { JhiRefreshService } from 'app/shared/refresh/refresh.service';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'jhi-home',
  templateUrl: './home.component.html',
  styleUrls: ['home.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  account: Account;
  modalRef: NgbModalRef;
  updatingHealth: boolean;
  healthData: any;
  appInstances: any;
  status: any;
  version: string;
  unsubscribe$ = new Subject();
  subscription: Subscription;

  constructor(
    private accountService: AccountService,
    private loginModalService: LoginModalService,
    private loginOAuth2Service: LoginOAuth2Service,
    private eventManager: JhiEventManager,
    private eurekaStatusService: EurekaStatusService,
    private applicationsService: JhiApplicationsService,
    private healthService: JhiHealthService,
    private profileService: ProfileService,
    private refreshService: JhiRefreshService
  ) {
    this.version = VERSION ? 'v' + VERSION : '';
    this.appInstances = [];
  }

  ngOnInit() {
    this.accountService
      .identity()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((account: Account) => {
        this.account = account;
        if (!account || !this.isAuthenticated()) {
          this.login();
        } else {
          this.refreshService.refreshReload$.pipe(takeUntil(this.unsubscribe$)).subscribe(() => this.populateDashboard());
          this.populateDashboard();
        }
      });
    this.registerAuthenticationSuccess();
  }

  registerAuthenticationSuccess() {
    this.subscription = this.eventManager.subscribe('authenticationSuccess', () => {
      this.accountService
        .identity()
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe(account => {
          this.account = account;
          this.refreshService.refreshReload$.pipe(takeUntil(this.unsubscribe$)).subscribe(() => this.populateDashboard());
          this.populateDashboard();
        });
    });
  }

  isAuthenticated() {
    return this.accountService.isAuthenticated();
  }

  login() {
    this.profileService
      .getProfileInfo()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(profileInfo => {
        if (profileInfo.activeProfiles.includes('oauth2')) {
          this.loginOAuth2Service.login();
        } else {
          this.modalRef = this.loginModalService.open();
        }
      });
  }

  populateDashboard() {
    this.eurekaStatusService
      .findAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(data => (this.status = data.status));

    this.applicationsService
      .findAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(data => {
        this.appInstances = [];
        for (const app of data.applications) {
          for (const inst of app.instances) {
            inst.name = app.name;
            this.appInstances.push(inst);
          }
        }
      });

    this.healthService
      .checkHealth()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(
        response => {
          this.healthData = this.healthService.transformHealthData(response);
          this.updatingHealth = false;
        },
        response => {
          this.healthData = this.healthService.transformHealthData(response.data);
          this.updatingHealth = false;
        }
      );
  }

  baseName(name: string) {
    return this.healthService.getBaseName(name);
  }

  subSystemName(name: string) {
    this.healthService.getSubSystemName(name);
  }

  getBadgeClass(statusState) {
    if (statusState === 'UP') {
      return 'badge-success';
    } else {
      return 'badge-danger';
    }
  }

  ngOnDestroy() {
    // prevent memory leak when component destroyed
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}