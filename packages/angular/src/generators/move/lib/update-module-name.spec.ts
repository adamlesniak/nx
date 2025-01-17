import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { moveGenerator } from '@nx/workspace/generators';
import { UnitTestRunner } from '../../../utils/test-runners';
import { generateTestLibrary } from '../../utils/testing';
import { NormalizedSchema } from '../schema';
import { updateModuleName } from './update-module-name';

describe('updateModuleName Rule', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should handle nesting resulting in the same project name', async () => {
    const updatedModulePath = '/libs/my/first/src/lib/my-first.module.ts';
    await generateTestLibrary(tree, {
      name: 'my-first',
      simpleName: true,
    });
    const schema: NormalizedSchema = {
      projectName: 'my-first',
      destination: 'my/first',
      updateImportPath: true,
      newProjectName: 'my-first',
      oldProjectRoot: 'my-first',
    };
    await moveGenerator(tree, schema);

    updateModuleName(tree, { ...schema, destination: 'my/first' });

    expect(tree.exists(updatedModulePath)).toBe(true);
    const moduleFile = tree.read(updatedModulePath, 'utf-8');
    expect(moduleFile).toContain(`export class MyFirstModule {}`);
  });

  describe('move to subfolder', () => {
    const updatedModulePath =
      '/libs/shared/my-first/src/lib/shared-my-first.module.ts';
    const updatedModuleSpecPath =
      '/libs/shared/my-first/src/lib/shared-my-first.module.spec.ts';
    const indexPath = '/libs/shared/my-first/src/index.ts';
    const secondModulePath = 'my-second/src/lib/my-second.module.ts';

    const schema: NormalizedSchema = {
      projectName: 'my-first',
      destination: 'shared/my-first',
      updateImportPath: true,
      newProjectName: 'shared-my-first',
      oldProjectRoot: 'my-first',
    };

    beforeEach(async () => {
      await generateTestLibrary(tree, {
        name: 'my-first',
        buildable: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });
      await generateTestLibrary(tree, {
        name: 'my-second',
        buildable: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });
      tree.write(
        'my-first/src/lib/my-first.module.ts',
        `import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @NgModule({
      imports: [CommonModule]
    })
    export class MyFirstModule {}`
      );

      tree.write(
        'my-first/src/lib/my-first.module.spec.ts',
        `import { async, TestBed } from '@angular/core/testing';
    import { MyFirstModule } from './my-first.module';

    describe('MyFirstModule', () => {
      beforeEach(async(() => {
        TestBed.configureTestingModule({
          imports: [MyFirstModule]
        }).compileComponents();
      }));

      it('should create', () => {
        expect(MyFirstModule).toBeDefined();
      });
    });`
      );
      tree.write(
        secondModulePath,
        `import { MyFirstModule } from '@proj/my-first';

      export class MySecondModule extends MyFirstModule {}
      `
      );
      await moveGenerator(tree, schema);
    });

    it('should rename the module files and update the module name', async () => {
      updateModuleName(tree, schema);

      expect(tree.exists(updatedModulePath)).toBe(true);
      expect(tree.exists(updatedModuleSpecPath)).toBe(true);

      const moduleFile = tree.read(updatedModulePath, 'utf-8');
      expect(moduleFile).toContain(`export class SharedMyFirstModule {}`);

      const moduleSpecFile = tree.read(updatedModuleSpecPath, 'utf-8');
      expect(moduleSpecFile).toContain(
        `import { SharedMyFirstModule } from './shared-my-first.module';`
      );
      expect(moduleSpecFile).toContain(
        `describe('SharedMyFirstModule', () => {`
      );
      expect(moduleSpecFile).toContain(`imports: [SharedMyFirstModule]`);
      expect(moduleSpecFile).toContain(
        `expect(SharedMyFirstModule).toBeDefined();`
      );
    });

    it('should update any references to the module', async () => {
      updateModuleName(tree, schema);

      const importerFile = tree.read(secondModulePath, 'utf-8');
      expect(importerFile).toContain(
        `import { SharedMyFirstModule } from '@proj/shared/my-first';`
      );
      expect(importerFile).toContain(
        `export class MySecondModule extends SharedMyFirstModule {}`
      );
    });

    it('should update the index.ts file which exports the module', async () => {
      updateModuleName(tree, schema);

      const indexFile = tree.read(indexPath, 'utf-8');
      expect(indexFile).toContain(
        `export * from './lib/shared-my-first.module';`
      );
    });
  });

  describe('rename', () => {
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      oldProjectRoot: 'my-source',
    };

    const modulePath = 'my-destination/src/lib/my-destination.module.ts';
    const moduleSpecPath =
      'my-destination/src/lib/my-destination.module.spec.ts';
    const indexPath = 'my-destination/src/index.ts';
    const importerPath = 'my-importer/src/lib/my-importing-file.ts';

    beforeEach(async () => {
      // fake a mid-move tree:
      await generateTestLibrary(tree, {
        name: 'my-destination',
        buildable: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });

      tree.write(
        'my-destination/src/lib/my-source.module.ts',
        `import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';
        @NgModule({
          imports: [CommonModule]
        })
        export class MySourceModule {}`
      );

      tree.write(
        'my-destination/src/lib/my-source.module.spec.ts',
        `import { async, TestBed } from '@angular/core/testing';
        import { MySourceModule } from './my-source.module';
        describe('MySourceModule', () => {
          beforeEach(async(() => {
            TestBed.configureTestingModule({
              imports: [MySourceModule]
            }).compileComponents();
          }));
          it('should create', () => {
            expect(MySourceModule).toBeDefined();
          });
        });`
      );

      tree.write(
        indexPath,
        `export * from './lib/my-source.module';
        `
      );

      tree.delete(modulePath);
      tree.delete(moduleSpecPath);

      await generateTestLibrary(tree, {
        name: 'my-importer',
        buildable: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });

      tree.write(
        importerPath,
        `import { MySourceModule } from '@proj/my-destination';
          export class MyExtendedSourceModule extends MySourceModule {}
          `
      );
    });

    it('should rename the module files and update the module name', async () => {
      updateModuleName(tree, schema);

      expect(tree.exists(modulePath)).toBe(true);
      expect(tree.exists(moduleSpecPath)).toBe(true);

      const moduleFile = tree.read(modulePath, 'utf-8');
      expect(moduleFile).toContain(`export class MyDestinationModule {}`);

      const moduleSpecFile = tree.read(moduleSpecPath, 'utf-8');
      expect(moduleSpecFile).toContain(
        `import { MyDestinationModule } from './my-destination.module';`
      );
      expect(moduleSpecFile).toContain(
        `describe('MyDestinationModule', () => {`
      );
      expect(moduleSpecFile).toContain(`imports: [MyDestinationModule]`);
      expect(moduleSpecFile).toContain(
        `expect(MyDestinationModule).toBeDefined();`
      );
    });

    it('should update any references to the module', async () => {
      updateModuleName(tree, schema);

      const importerFile = tree.read(importerPath, 'utf-8');
      expect(importerFile).toContain(
        `import { MyDestinationModule } from '@proj/my-destination';`
      );
      expect(importerFile).toContain(
        `export class MyExtendedSourceModule extends MyDestinationModule {}`
      );
    });

    it('should update the index.ts file which exports the module', async () => {
      updateModuleName(tree, schema);

      const indexFile = tree.read(indexPath, 'utf-8');
      expect(indexFile).toContain(
        `export * from './lib/my-destination.module';`
      );
    });

    it('should not rename unrelated symbols with similar name in different projects', async () => {
      // create different project whose main module name starts with the same
      // name of the project we're moving
      await generateTestLibrary(tree, {
        name: 'my-source-demo',
        buildable: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });

      updateModuleName(tree, schema);

      const moduleFile = tree.read(
        'my-source-demo/src/lib/my-source-demo.module.ts',
        'utf-8'
      );
      expect(moduleFile).toContain(`export class MySourceDemoModule {}`);
    });
  });
});
