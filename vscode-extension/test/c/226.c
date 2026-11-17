#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>



static struct TreeNode *invertTree(struct TreeNode* root)
{
    if (root == NULL) {
        return NULL;
    }

    struct TreeNode *l = invertTree(root->left);
    struct TreeNode *r = invertTree(root->right);
    root->left = r;
    root->right = l;
    return root;
}
